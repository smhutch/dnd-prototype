import {
  CSSProperties,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { HTML5Backend, getEmptyImage } from "react-dnd-html5-backend";
import { DndProvider, useDrag, useDragLayer, useDrop } from "react-dnd";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import "./styles.css";
import { lerp } from "./helpers";
import cuid from "cuid";
import Chance from "chance";
import { mergeRefs } from "react-merge-refs";

const chance = new Chance();

const BIG_DRAGGABLE = "chonk";
const SMALL_DRAGGABLE = "smol";

const IMAGE_SIZE = 1200;

let imageId = 1;
const getImageUrl = () => {
  const url = `/artwork/${imageId}.jpg`;
  imageId++;

  return url;
};

type ItemConfig = {
  id: string;
  imageUrl: string;
  username: string;
  size: "small" | "big";
};

// ----
const RATIO = [1, 0]; // [small, big]
const NUMBER_OF_ITEMS = 4;

const debounce = (fn: Function, ms = 300) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

const makeItem = (size: ItemConfig["size"]): ItemConfig => ({
  id: cuid(),
  imageUrl: getImageUrl(),
  size,
  username: "@adam",
});

const initialItems = Array.from({ length: NUMBER_OF_ITEMS })
  .map((_): ItemConfig => makeItem(chance.weighted(["small", "big"], RATIO)))
  .reverse();

const getDraggableId = (id: string) => `draggable-${id}`;

const Avatar = () => {
  return (
    <img
      src="/avatar.jpg"
      style={{
        width: 24,
        height: 24,
        borderRadius: 999,
        marginRight: 16,
      }}
    />
  );
};

export const CustomDragLayer = (props: any) => {
  const layer = useDragLayer((monitor) => {
    return {
      item: monitor.getItem(),
      itemType: monitor.getItemType(),
      // coord offset of pointer at time when drag operation started
      initialClientOffset: monitor.getInitialClientOffset(),
      // coord offset of the dragged items root DOM node when drag started
      // this does not account for the width/height of the el
      initialSourceClientOffset: monitor.getInitialSourceClientOffset(),
      // coord of the pointer
      clientOffset: monitor.getClientOffset(),
      // coord difference between pointer, and when it started
      differenceFromInitialOffset: monitor.getDifferenceFromInitialOffset(),
      // TODO: how to explain this one???
      sourceClientOffset: monitor.getSourceClientOffset(),
      isDragging: monitor.isDragging(),
      diff: monitor.getDifferenceFromInitialOffset(),
    };
  });
  const lastKnownOffset = useRef(layer.initialSourceClientOffset);

  const sizes = useMemo(() => {
    if (!layer.item) return {};

    const root = document.querySelector(".root");
    const el = document.getElementById(getDraggableId(layer.item.id));

    const rootRect = root?.getBoundingClientRect();
    const rect = el?.getBoundingClientRect();

    return {
      rect,
      rootRect,
    };
  }, [layer.item?.id]);

  const getInlineStyles = (): CSSProperties => {
    if (!sizes.rect) return {};

    // @ts-expect-error
    const initialX = layer.initialSourceClientOffset.x;
    // @ts-expect-error
    const initialY = layer.initialSourceClientOffset.y;

    // // @ts-expect-error
    // const ox = initialX - layer.initialSourceClientOffset.x;
    // // @ts-expect-error
    // const oy = initialY - layer.initialSourceClientOffset.y;

    // @ts-expect-error
    const x = layer.sourceClientOffset.x - sizes.rootRect?.left;
    // @ts-expect-error
    const y = layer.sourceClientOffset.y - sizes.rootRect?.top;

    const maxDistanceScaleX = sizes.rect?.width * 0.8;
    const maxDistanceScaleY = sizes.rect?.height * 0.8;

    const SCALE_MAX = 0.5;
    const dxp =
      // @ts-expect-error
      Math.min(maxDistanceScaleX, layer.differenceFromInitialOffset.x) /
      maxDistanceScaleX;
    const dxy =
      // @ts-expect-error
      Math.min(maxDistanceScaleY, layer.differenceFromInitialOffset.y) /
      maxDistanceScaleY;

    let scale = lerp(1, SCALE_MAX, Math.abs(dxp * dxy));
    scale = 1;

    // ----
    let ROTATE_MAX = 5;
    let rotation =
      dxp > 0
        ? lerp(0, ROTATE_MAX, Math.abs(dxp))
        : lerp(0, -ROTATE_MAX, Math.abs(dxp));

    const transform = [
      `translate(${x}px, ${y}px)`,
      `rotate(${rotation}deg)`,
      `scale(${scale})`,
    ].join(" ");

    return {
      height: sizes.rect?.height ?? 0,
      width: sizes.rect?.width,
      maxWidth: sizes.rect?.width,
      // background: "#e5e5e5",
      transform,
    };
  };

  const getPos = () => {
    if (!sizes.rect) return {};

    // @ts-expect-error
    const x = layer.sourceClientOffset.x - sizes.rootRect?.left;
    // @ts-expect-error
    const y = layer.sourceClientOffset.y - sizes.rootRect?.top;

    return {
      x,
      y,
    };
  };
  const styles = getInlineStyles();
  const pos = getPos();

  useEffect(() => {
    if (layer.initialSourceClientOffset) {
      lastKnownOffset.current = {
        // @ts-expect-error
        x: layer.initialSourceClientOffset.x - sizes.rootRect?.left,
        // @ts-expect-error
        y: layer.initialSourceClientOffset.y - sizes.rootRect?.top,
      };
    }
  }, [layer.initialSourceClientOffset]);

  return (
    <AnimatePresence initial={false}>
      {layer.isDragging && (
        <motion.div
          // exit={{
          //   x: lastKnownOffset.current?.x || 0,
          //   y: lastKnownOffset.current?.y || 0,
          //   transition: {
          //     duration: 0.8,
          //     type: "spring",
          //   },
          // }}
          // animate={{
          //   x: pos.x,
          //   y: pos.y,
          // }}
          // animate={{
          //   ...(styles as any),
          //   transition: {
          //     duration: 0.8,
          //     type: "spring",
          //   },
          // }}
          style={{
            ...styles,
            pointerEvents: "none",
          }}
          className="item card shadow dragger"
        >
          <div
            className="body"
            style={{
              backgroundImage: `url(${layer.item.imageUrl})`,
            }}
          />
          <div className="footer">
            <Avatar />
            {layer.item.username}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

function ArtworkCard(
  props: ItemConfig & {
    changeSize(): void;
    remove(): void;
    isHovered: boolean;
    isPickedUp: boolean;
    onEndDrag(): void;
  } & any
) {
  const rootRef = useRef<HTMLDivElement>(null);

  const rootBox = rootRef.current
    ? rootRef.current.getBoundingClientRect()
    : null;

  const [dragProps, dragRef, preview] = useDrag(
    () => ({
      type: props.size === "small" ? SMALL_DRAGGABLE : BIG_DRAGGABLE,
      item: {
        index: props.index,
        id: props.id,
        imageUrl: props.imageUrl,
        username: props.username,
        size: props.size,
      },
      end: () => props.onEndDrag(),
      collect: (monitor) => {
        return {
          m: monitor.isDragging(),
        };
      },
    }),
    [props.onEndDrag]
  );

  const [dropProps, dropRef] = useDrop(
    () => ({
      // accept: props.size === "small" ? SMALL_DRAGGABLE : BIG_DRAGGABLE,
      accept: [SMALL_DRAGGABLE, BIG_DRAGGABLE],
      collect: (monitor) => {
        return {
          over: monitor.isOver(),
        };
      },
      hover: (draggedItem, monitor) => {
        if (!rootBox) return;

        const debounced = debounce(props.onHoverWhileDragging, 100);

        const pointer = monitor.getClientOffset();
        if (!pointer) return;
        const x1 = rootBox.left + rootBox.width * 0.5;
        const x2 = rootBox.left + rootBox.width * 0.5;

        // if (props.index === draggedItem.index - 1) {
        //   if (pointer.x < x1) {
        //     return props.onHoverWhileDragging({
        //       position: "before",
        //       id: props.id as string,
        //     });
        //   } else {
        //     return props.onHoverWhileDragging({
        //       position: "after",
        //       id: props.id as string,
        //     });
        //   }
        // }

        // if (props.index === draggedItem.index + 1) {
        //   if (pointer.x < x2) {
        //     return props.onHoverWhileDragging({
        //       position: "before",
        //       id: props.id as string,
        //     });
        //   } else {
        //     return props.onHoverWhileDragging({
        //       position: "after",
        //       id: props.id as string,
        //     });
        //   }
        // }

        if (props.index < draggedItem.index) {
          return props.onHoverWhileDragging({
            position: "before",
            id: props.id as string,
          });
        }

        if (props.index > draggedItem.index) {
          return props.onHoverWhileDragging({
            position: "after",
            id: props.id as string,
          });
        }
      },
      drop: (drag: any) => {
        props.onDrop(drag.id, props.id);
      },
    }),
    [props.onHover, props.isDragged, rootBox]
  );

  // console.log(dropProps);

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, []);

  const animationVariants = {
    hidden: { opacity: 1, scaleX: 1 },
    show: { opacity: 1, scaleX: 1 },
    dragging: { opacity: 0.2, scaleX: 1 },
  };

  if (props.isPickedUp) {
    if (props.isDraggingOverDropzone) {
      return null;
    } else {
      // This is intentionally NOT a dropzone
      return (
        <motion.div
          className={`item empty ${props.size}`}
          // style={{ background: "red" }}
          layout
        />
      );
    }
  }

  return (
    <motion.div
      id={getDraggableId(props.id)}
      ref={mergeRefs([dragRef, rootRef])}
      className={`item card shadow ${props.size}`}
      style={{
        transformOrigin: "top left",
        height: "100%",
      }}
      initial={animationVariants.hidden}
      animate={props.isPickedUp ? "dragging" : "show"}
      onLayoutAnimationStart={() => {
        console.log("i layout start");
        props.onLayoutAnimationStart();
      }}
      onLayoutAnimationComplete={() => {
        console.log("i layout complete");
        props.onLayoutAnimationComplete();
      }}
      variants={animationVariants}
      draggable={true}
      onDrag={() => {
        // console.log("started...");
      }}
      onDoubleClick={() => props.changeSize()}
      layout
    >
      <button
        className="close"
        aria-label="Close"
        onClick={() => props.remove()}
      >
        <span>×</span>
      </button>
      <div
        className="body"
        style={{
          backgroundImage: `url(${props.imageUrl})`,
        }}
      />
      <motion.div className="footer">
        <Avatar />
        {props.username} {props.index}
      </motion.div>
      <div
        ref={dropRef}
        style={{
          background: dropProps.over ? "red" : "blue",
          position: "absolute",
          opacity: 0.2,
          inset: 0,
          display: props.draggedItem ? "block" : "none",
        }}
      />
    </motion.div>
  );
}

function Grid() {
  const [items, setItems] = useState(initialItems);
  const [draggingOver, setDraggingOver] = useState<{
    id: ItemConfig["id"];
    position: "before" | "after";
  } | null>(null);
  const [isInitialAnimationEnabled, setIsInitialAnimationEnabled] =
    useState(false);

  const layer = useDragLayer((monitor) => {
    return {
      itemType: monitor.getItemType(),
      item: monitor.getItem(),
    };
  });

  useEffect(() => {
    if (layer.itemType && isInitialAnimationEnabled === false) {
      setIsInitialAnimationEnabled(true);
    }
  }, [layer.itemType, isInitialAnimationEnabled]);

  const add = (size: "small" | "big", position: number) => {
    const updatedItems = [...items];
    updatedItems.splice(position, 0, makeItem(size));
    setItems(updatedItems);
  };

  const remove = (id: string) => {
    const index = items.findIndex((item) => item.id === id);
    if (index !== -1) {
      const updatedItems = [...items];
      updatedItems.splice(index, 1);
      setItems(updatedItems);
    }
  };

  const changeSize = (id: string) => {
    const index = items.findIndex((item) => item.id === id);
    if (index !== -1) {
      const updatedItems = [...items];
      const item = updatedItems[index];
      item.size = item.size === "small" ? "big" : "small";
      setItems(updatedItems);
    }
  };

  const [enableMoveOnHover, setEnableMoveOnHover] = useState(true);

  return (
    <MotionConfig
      transition={{ type: "spring", damping: 12, mass: 0.2, stiffness: 150 }}
    >
      <div className="root container">
        <div className={`grid base ${layer.itemType ? "active" : ""}`}>
          <AnimatePresence key={"item"} initial={false}>
            {items.map((item, index) => {
              const isPickedUp = Boolean(
                layer.item && layer.item.id === item.id
              );
              const isDraggingOverDropzone = Boolean(draggingOver);
              const isHovered = draggingOver
                ? draggingOver.id === item.id
                : false;

              console.log(draggingOver);

              // console.log(layer.item);

              const dropIndicator = isHovered ? (
                <motion.div
                  className={`item empty ${layer ? layer.item.size : ""}`}
                  onLayoutAnimationStart={() => {
                    console.log("layout start");
                  }}
                  onLayoutAnimationComplete={() => {
                    console.log("layout complete");
                  }}
                  onAnimationStart={() => {
                    console.log("gold start");
                  }}
                  onAnimationComplete={() => {
                    console.log("gold complete");
                  }}
                  onAnimationEnd={() => {
                    console.log("gold end");
                  }}
                  style={{ background: "gold" }}
                  layout
                />
              ) : null;

              let dropIndicatorPosition = "NONE";
              if (draggingOver) {
                if (draggingOver.position === "after") {
                  dropIndicatorPosition = "AFTER";
                }

                if (draggingOver.position === "before") {
                  dropIndicatorPosition = "BEFORE";
                }
              }
              // if (layer.item) {
              //   if (layer.item.index > index) {
              //     dropIndicatorPosition = "BEFORE";
              //   }
              //   // if (layer.item.index === index - 1) {
              //   //   dropIndicatorPosition = "BEFORE";
              //   // }
              //   if (layer.item.index < index) {
              //     dropIndicatorPosition = "AFTER";
              //   }
              // }

              return (
                <Fragment key={`item-${item.id}`}>
                  {dropIndicatorPosition === "BEFORE" && dropIndicator}
                  {/* if item has been picked up, but is being dragged over another item, remove the source item from the grid */}
                  {isPickedUp &&
                  draggingOver &&
                  draggingOver.id !== null ? null : (
                    <ArtworkCard
                      index={index}
                      isPickedUp={isPickedUp}
                      onEndDrag={() => setDraggingOver(null)}
                      isDraggingOverDropzone={isDraggingOverDropzone}
                      isHovered={isHovered}
                      changeSize={() => changeSize(item.id)}
                      remove={() => remove(item.id)}
                      draggedItem={layer.item}
                      onLayoutAnimationComplete={() =>
                        setEnableMoveOnHover(true)
                      }
                      onLayoutAnimationStart={() => setEnableMoveOnHover(false)}
                      onHoverWhileDragging={(arg: any) => {
                        enableMoveOnHover && setDraggingOver(arg);
                      }}
                      {...item}
                    />
                  )}
                  {dropIndicatorPosition === "AFTER" && dropIndicator}
                </Fragment>
              );
            })}
          </AnimatePresence>
        </div>
        <CustomDragLayer />
      </div>
    </MotionConfig>
  );
}

export default function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      <Grid />
    </DndProvider>
  );
}
