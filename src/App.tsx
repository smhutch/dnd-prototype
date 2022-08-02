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
const NUMBER_OF_ITEMS = 8;

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
  // console.log(props);
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
    let ROTATE_MAX = 3;
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
          style={{
            ...styles,
            pointerEvents: "none",
          }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
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

const DEBUG_MODE = true as boolean;

type DebugLogOption = {
  draggedIndex: number;
  hoveringOverIndex: number;
  position: "BEFORE" | "AFTER";
};

const debugLog = (message: string, options: DebugLogOption) => {
  if (!DEBUG_MODE) return;
  console.debug("dnd", message, options);
};

function ArtworkCard(
  props: ItemConfig & {
    changeSize(): void;
    remove(): void;
    isHovered: boolean;
    isPickedUp: boolean;
    onEndDrag(): void;
    draggedItemRect: DOMRect | null;
  } & any
) {
  const rootRef = useRef<HTMLDivElement>(null);

  const rootRect = rootRef.current
    ? rootRef.current.getBoundingClientRect()
    : null;

  const [_dragProps, dragRef, preview] = useDrag(
    () => ({
      type: props.size === "small" ? SMALL_DRAGGABLE : BIG_DRAGGABLE,
      item: {
        index: props.index,
        id: props.id,
        imageUrl: props.imageUrl,
        username: props.username,
        size: props.size,
      },
      end: (e) => {
        props.onEndDrag();
      },
    }),
    [props.onEndDrag]
  );

  const [_dropProps, dropRef] = useDrop(
    () => ({
      accept:
        props.size === "big"
          ? [BIG_DRAGGABLE]
          : [SMALL_DRAGGABLE, BIG_DRAGGABLE],
      collect: (monitor) => {
        return {
          over: monitor.isOver(),
        };
      },
      canDrop: () => {
        return props.enableMoveOnHover && props.size !== "big";
      },
      hover: (draggedItem, monitor) => {
        const { draggedItemRect } = props;
        if (!props.enableMoveOnHover) return;
        if (!draggedItemRect) return;

        if (!rootRect) return;

        const pointer = monitor.getClientOffset();

        const sourcePosition = monitor.getInitialSourceClientOffset();
        const initialPointer = monitor.getInitialClientOffset();

        const addShadow = (position: "BEFORE" | "AFTER") => {
          return props.onHoverWhileDragging({
            position,
            id: props.id,
            index: props.index,
          });
        };

        const debugHoverLog = (message: string, position: "BEFORE" | "AFTER") =>
          debugLog(message, {
            draggedIndex: draggedItem.index,
            hoveringOverIndex: props.index,
            position,
          });

        if (!pointer || !initialPointer || !sourcePosition) return;

        /**
         * Check if user is dragging over the INITIAL position of the dragged item
         * If so, create a space for the user to put it back down.
         */
        if (
          pointer.x > draggedItemRect.left &&
          pointer.x < draggedItemRect.left + draggedItemRect.width &&
          pointer.y > draggedItemRect.top &&
          pointer.y < draggedItemRect.top + draggedItemRect.height
        ) {
          const POSITION = props.index > draggedItem.index ? "BEFORE" : "AFTER";
          debugHoverLog("INITIAL", POSITION);
          return addShadow(POSITION);
        }

        if (props.draggingOver && props.draggingOver.position !== "NONE") {
          /**
           * If a dropzone is already displayed for the current item, and the ....
           */
          if (props.draggingOver.id === props.id) {
            const POSITION =
              props.draggingOver.position === "AFTER" ? "BEFORE" : "AFTER";

            debugHoverLog("TOGGLE", POSITION);
            return addShadow(POSITION);
          }

          /**
           * If the current inticator is AFTER the current item, the user must be moving the dragged item
           * to the left, so we need to show the indicator before the current item.
           */
          if (props.draggingOver.index > props.index) {
            debugHoverLog("MOVE", "BEFORE");
            return addShadow("BEFORE");
          }

          /**
           * If the current inticator is AFTER the current item, the user must be moving the dragged item
           * to the left, so we need to show the indicator before the current item.
           */
          if (props.draggingOver.index < props.index) {
            debugHoverLog("MOVE", "AFTER");
            return addShadow("AFTER");
          }
        }

        if (props.index < draggedItem.index) {
          debugHoverLog("FIRST", "BEFORE");
          return addShadow("BEFORE");
        } else {
          debugHoverLog("FIRST", "BEFORE");
          return addShadow("AFTER");
        }
      },
      drop: (drag: any) => {
        // We do not use on drop...
      },
    }),
    [
      props.enableMoveOnHover,
      props.draggedItemRect,
      props.dropIndicatorPosition,
      props.draggingOver,
      rootRect,
    ]
  );

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
      data-size={props.size}
      initial={animationVariants.hidden}
      animate={props.isPickedUp ? "dragging" : "show"}
      onLayoutAnimationStart={() => {
        props.onLayoutAnimationStart();
      }}
      onLayoutAnimationComplete={() => {
        props.onLayoutAnimationComplete();
      }}
      variants={animationVariants}
      draggable={true}
      onDragStart={() => {
        if (rootRef.current) {
          props.setDraggedItemRect(rootRef.current.getBoundingClientRect());
        }
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
        item {props.index}
      </motion.div>
      <div
        ref={dropRef}
        style={{
          // background: dropProps.over ? "red" : "blue",
          position: "absolute",
          opacity: 0.2,
          inset: 0,
          // display: props.draggedItem ? "block" : "none",
        }}
      />
    </motion.div>
  );
}

type DropProps = {
  onDrop: (drag: any) => void;
  size: "small" | "big";
};

function Drop(props: DropProps) {
  const [dropProps, dropRef] = useDrop(
    () => ({
      accept: [SMALL_DRAGGABLE, BIG_DRAGGABLE],
      drop: (dragItem: any) => {
        console.log();
        props.onDrop(dragItem);
      },
    }),
    []
  );

  return (
    <motion.div ref={dropRef} className={`item empty ${props.size}`} layout />
  );
}

function Grid() {
  const [items, setItems] = useState(initialItems);
  const [draggedItemRect, setDraggedItemRect] = useState<DOMRect | null>(null);
  const [draggingOver, setDraggingOver] = useState<{
    id: ItemConfig["id"];
    position: "BEFORE" | "AFTER";
  } | null>(null);
  const draggedItemRef = useRef<any>(null);
  const [isInitialAnimationEnabled, setIsInitialAnimationEnabled] =
    useState(false);

  // console.log(draggedItemRef);

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

              const dropIndicatorPosition = draggingOver
                ? draggingOver.position
                : "NONE";

              const onDrop = (
                position: "BEFORE" | "AFTER",
                droppedItem: any
              ) => {
                const droppedItemIndex = droppedItem.index;
                const droppedOnIndex = index;

                if (
                  position === "AFTER" &&
                  droppedOnIndex + 1 === droppedItemIndex
                ) {
                  return;
                }

                if (
                  position === "BEFORE" &&
                  droppedOnIndex - 1 === droppedItemIndex
                ) {
                  return;
                }

                if (droppedItemIndex !== -1 && droppedOnIndex !== -1) {
                  const updatedItems = [...items];
                  // remove dragged item from array
                  const removedItems = updatedItems.splice(droppedItemIndex, 1);
                  // insert dragged item at new index
                  updatedItems.splice(droppedOnIndex, 0, removedItems[0]);
                  setItems(updatedItems);
                }
              };

              return (
                <Fragment key={`item-${item.id}`}>
                  {isHovered && dropIndicatorPosition === "BEFORE" && (
                    <Drop
                      size={layer.item?.size}
                      onDrop={(droppedItem) => onDrop("BEFORE", droppedItem)}
                    />
                  )}
                  {/* if item has been picked up, but is being dragged over another item, remove the source item from the grid */}
                  {isPickedUp &&
                  draggingOver &&
                  draggingOver.id !== null ? null : (
                    <ArtworkCard
                      index={index}
                      isPickedUp={isPickedUp}
                      onEndDrag={() => {
                        setDraggingOver(null);
                      }}
                      isDraggingOverDropzone={isDraggingOverDropzone}
                      isHovered={isHovered}
                      changeSize={() => changeSize(item.id)}
                      remove={() => remove(item.id)}
                      draggedItem={layer.item}
                      onLayoutAnimationComplete={() =>
                        setEnableMoveOnHover(true)
                      }
                      dropIndicatorPosition={dropIndicatorPosition}
                      onLayoutAnimationStart={() => setEnableMoveOnHover(false)}
                      onHoverWhileDragging={(arg: any) => {
                        enableMoveOnHover && setDraggingOver(arg);
                      }}
                      enableMoveOnHover={enableMoveOnHover}
                      draggedItemRef={draggedItemRef}
                      draggedItemRect={draggedItemRect}
                      setDraggedItemRect={setDraggedItemRect}
                      draggingOver={draggingOver}
                      onDrop={(droppedId: string, droppedOnId: string) => {
                        console.log(droppedId, droppedOnId);
                        // const droppedIndex = items.findIndex(
                        //   ({ id }) => id === droppedId
                        // );

                        // const droppedOnIndex = items.findIndex(
                        //   ({ id }) => id === droppedOnId
                        // );

                        // if (droppedIndex !== -1 && droppedOnIndex !== -1) {
                        //   const updatedItems = [...items];
                        //   // remove dragged item from array
                        //   const removedItems = updatedItems.splice(
                        //     droppedIndex,
                        //     1
                        //   );
                        //   updatedItems.splice(
                        //     droppedOnIndex === 0
                        //       ? 0
                        //       : droppedIndex > droppedOnIndex
                        //       ? droppedOnIndex
                        //       : droppedOnIndex - 1,
                        //     0,
                        //     removedItems[0]
                        //   );
                        //   setItems(updatedItems);
                        // }
                      }}
                      {...item}
                    />
                  )}
                  {isHovered && dropIndicatorPosition === "AFTER" && (
                    <Drop
                      size={layer.item?.size}
                      onDrop={(droppedItem) => onDrop("AFTER", droppedItem)}
                    />
                  )}
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
