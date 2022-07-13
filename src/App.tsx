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
import {
  AnimatePresence,
  isDragActive,
  LayoutGroup,
  motion,
  MotionTransform,
} from "framer-motion";
import { mergeRefs } from "react-merge-refs";
import "./styles.css";
import { lerp } from "./helpers";
import cuid from "cuid";
import Chance from "chance";

const chance = new Chance();

const BIG_DRAGGABLE = "chonk";
const SMALL_DRAGGABLE = "smol";

const IMAGE_SIZE = 1200;
const getImageUrl = (name: string) => {
  const url = `https://picsum.photos/${IMAGE_SIZE}/${IMAGE_SIZE}?r=${name
    .replace(/ /g, "-")
    .toLowerCase()}`;

  return url;
};

type ItemConfig = {
  id: string;
  name: string;
  size: "small" | "big";
};

const RATIO = [1, 0]; // [small, big]
const NUMBER_OF_ITEMS = 12;
const BIG_ITEMS_MAX = Math.ceil(NUMBER_OF_ITEMS / 4);

const makeItem = (size: ItemConfig["size"]) => ({
  id: cuid(),
  size,
  name: chance.pickone([
    chance.name(),
    chance.animal(),
    chance.company(),
    chance.city(),
  ]),
});

const initialItems = Array.from({ length: NUMBER_OF_ITEMS }).map(
  (_): ItemConfig => makeItem(chance.weighted(["small", "big"], RATIO))
);

const getDraggableId = (id: string) => `draggable-${id}`;

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

  // if (!layer.isDragging) {
  //   return (
  //     <div className="item card dragger">
  //       <div
  //         className="body"
  //         style={{
  //           backgroundImage: `url(${getImageUrl("foo")})`,
  //         }}
  //       />
  //       <div className="footer">{"foo"}</div>
  //     </div>
  //   );
  // }

  const getInlineStyles = (): CSSProperties => {
    if (!sizes.rect) return {};

    // @ts-expect-error
    const initialX = layer.initialSourceClientOffset.x;
    // @ts-expect-error
    const initialY = layer.initialSourceClientOffset.y;

    // console.log(initialX, initialY);

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

    const ROTATE_MAX = 3;
    const rotation =
      dxp > 0
        ? lerp(0, ROTATE_MAX, Math.abs(dxp))
        : lerp(0, -ROTATE_MAX, Math.abs(dxp));

    const transform = [
      `translate(${x}px, ${y}px)`,
      `rotate(${rotation}deg)`,
      // `scale(${scale})`,
    ].join(" ");

    return {
      height: sizes.rect?.height ?? 0,
      width: sizes.rect?.width,
      maxWidth: sizes.rect?.width,
      background: "#e5e5e5",
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

  // if (layer.isDragging) {
  //   console.log(
  //     layer && layer.sourceClientOffset ? layer.sourceClientOffset.x : 0,
  //     layer && layer.initialSourceClientOffset
  //       ? layer.initialSourceClientOffset.x
  //       : 0,
  //     sizes.rect?.top
  //   );
  // }

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
          }}
          className="item card shadow dragger"
        >
          <div
            className="body"
            style={{
              backgroundImage: `url(${getImageUrl(layer.item.name)})`,
            }}
          />
          <div className="footer">{layer.item.name}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

function Item(
  props: ItemConfig & {
    changeSize(): void;
    remove(): void;
    isDragActive: boolean;
    isHovered: boolean;
    onEndDrag(): void;
  }
) {
  const [_, dragRef, preview] = useDrag(
    () => ({
      type: props.size === "small" ? SMALL_DRAGGABLE : BIG_DRAGGABLE,
      item: props,
      end: () => props.onEndDrag(),
    }),
    [props.onEndDrag]
  );

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, []);

  const animationVariants = {
    hidden: { opacity: 0, scaleX: 0 },
    show: { opacity: 1, scaleX: 1 },
    dragging: { opacity: 0.2, scaleX: 1 },
  };

  if (props.isDragActive) {
    return <motion.div className="item empty"></motion.div>;
  }

  // if (props.isDragActive) {
  //   if (props.isHovered) {
  //     return (
  //       <motion.div
  //         className="item empty"
  //         exit={{
  //           opacity: 0,
  //           transition: {
  //             duration: 0.2,
  //           },
  //         }}
  //         style={{ color: "red" }}
  //       >
  //         HOVERED
  //       </motion.div>
  //     );
  //   } else {
  //     return (
  //       <motion.div className="item empty" style={{ color: "red" }}>
  //         OUT
  //       </motion.div>
  //     );
  //   }
  // }

  return (
    <motion.div
      id={getDraggableId(props.id)}
      ref={dragRef}
      className={`item card shadow ${props.size}`}
      style={{
        transformOrigin: "top left",
      }}
      initial={animationVariants.hidden}
      animate={props.isDragActive ? "dragging" : "show"}
      exit={{
        opacity: 0,
        transition: {
          duration: 0.2,
        },
      }}
      variants={animationVariants}
      transition={{ duration: 0.6, type: "spring" }}
      draggable={true}
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
          backgroundImage: `url(${getImageUrl(props.name)})`,
        }}
      />
      <motion.div className="footer">{props.name}</motion.div>
    </motion.div>
  );
}

function Drop(props: ItemConfig & { onHover(id: string): void }) {
  const [dropProps, dropRef] = useDrop(
    () => ({
      accept: props.size === "small" ? SMALL_DRAGGABLE : BIG_DRAGGABLE,
      collect: (monitor) => {
        return {
          over: monitor.isOver(),
        };
      },
      hover: () => {
        props.onHover(props.id as string);
      },
      drop: () => {
        // alert("dropped");
      },
    }),
    [props.onHover]
  );

  // console.log(dropProps);

  // console.log(dropProps.over, dropProps.foo);

  return (
    <div
      ref={dropRef}
      className={`item drop ${props.size}`}
      style={{
        // opacity: props.size === "big" ? dropProps.opacity : dropProps.opacity,
        // opacity: dropProps.opacity,
        // pointerEvents: dropProps.over ? "auto" : "none",
        // background: dropProps.over ? "rgba(255,255,0,0.4)" : "transparent",
        // background: "red",
        transition: "opacity 0.2s ease",
      }}
    />
  );
}

function Grid() {
  const [items, setItems] = useState(initialItems);
  const [hoveredId, setHoveredId] = useState<ItemConfig["id"] | null>(null);
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
    // console.log({ id, index });
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

  const isDragging = Boolean(layer.item);

  return (
    <>
      <div className="container">
        <button onClick={() => add("small", 0)}>add small p1</button>
        <button onClick={() => add("big", 0)}>add big p1</button>
        <button onClick={() => add("small", 3)}>add small p4</button>
        <button onClick={() => add("big", 3)}>add big p4</button>
        <br />
        <br />
      </div>
      <div className="root container">
        <div className={`grid base ${layer.itemType ? "active" : ""}`}>
          <AnimatePresence key={"item"} initial={false}>
            {items.map((item) => {
              const isDragActive = layer.item && layer.item.id === item.id;
              const isHovered = hoveredId === item.id;

              return (
                <Fragment key={`item-${item.id}`}>
                  {!isDragActive && isHovered && (
                    <motion.div
                      className="item empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: 0.6,
                        type: "spring",
                        // ease: "easeInOut",
                      }}
                      style={
                        {
                          // background: "red",
                        }
                      }
                    ></motion.div>
                  )}
                  <Item
                    isDragActive={isDragActive}
                    onEndDrag={() => setHoveredId(null)}
                    isHovered={isHovered}
                    changeSize={() => changeSize(item.id)}
                    remove={() => remove(item.id)}
                    {...item}
                  />
                </Fragment>
              );
            })}
          </AnimatePresence>
        </div>
        {isDragging && (
          <div className="grid dropgrid small">
            {items.map((item) => {
              return (
                <Drop
                  key={"drop-small" + item.id}
                  {...item}
                  size="small"
                  onHover={setHoveredId}
                />
              );
            })}
          </div>
        )}
        {/* <div className="grid dropgrid big">
          {[...items].splice(0, BIG_ITEMS_MAX).map((item) => {
            return <Drop key={"drop-big" + item.id} {...item} size="big" />;
          })}
        </div> */}
        <CustomDragLayer />
        <Toolbar isDragActive={Boolean(layer.item)} remove={remove} />
      </div>
    </>
  );
}

function Toolbar(props: { isDragActive: boolean; remove(id: string): void }) {
  const [dropProps, dropRef] = useDrop(
    () => ({
      accept: [SMALL_DRAGGABLE],
      collect: (monitor) => {
        return {
          over: monitor.isOver(),
        };
      },
      drop: (item: ItemConfig) => {
        props.remove(item.id);
      },
    }),
    [props.remove]
  );

  return (
    <AnimatePresence>
      {props.isDragActive && (
        <div className="toolbar-container">
          <motion.div
            initial={"hidden"}
            animate="visible"
            variants={{
              visible: { opacity: 1, y: 0 },
              hidden: { opacity: 0, y: 120 },
            }}
            className="toolbar shadow"
            style={{
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              ref={dropRef}
              className="item"
              style={{
                background: `rgba(0,0,0,${dropProps.over ? 0.1 : 0.05})`,
              }}
            >
              Drop here to remove
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      <Grid />
    </DndProvider>
  );
}
