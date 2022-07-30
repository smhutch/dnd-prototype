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
const NUMBER_OF_ITEMS = 24;

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
      item: {
        id: props.id,
        imageUrl: props.imageUrl,
        username: props.username,
      },
      end: () => props.onEndDrag(),
    }),
    [props.onEndDrag]
  );

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, []);

  const animationVariants = {
    hidden: { opacity: 1, scaleX: 1 },
    show: { opacity: 1, scaleX: 1 },
    dragging: { opacity: 0.2, scaleX: 1 },
  };

  if (props.isDragActive) {
    if (props.isHovered) {
      return null;
    } else {
      return <motion.div className="item empty" layout />;
    }
  }

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
      exit={
        {
          // opacity: 0,
          // transition: {
          //   duration: 0.2,
          // },
        }
      }
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
        {props.username}
      </motion.div>
    </motion.div>
  );
}

function Drop(
  props: ItemConfig & {
    isDragged: boolean;
    onDrop(droppedItemId: string, moveToBeforeItemId: string): void;
    onHover(id: string): void;
    // onHoverPickedUp(id: string): void;
  }
) {
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
      drop: (drag: any) => {
        props.onDrop(drag.id, props.id);
      },
    }),
    [props.onHover, props.isDragged]
  );
  const [baseProps, baseDropRef] = useDrop(
    () => ({
      accept: props.size === "small" ? SMALL_DRAGGABLE : BIG_DRAGGABLE,
      hover: () => {
        props.onHover(props.id as string);
      },
    }),
    [props.onHover, props.isDragged]
  );

  if (props.isDragged) {
    return (
      <div
        ref={baseDropRef}
        className={`item empty ${props.size}`}
        style={{
          // making this 'all' breaks chrome
          // must be 'none' to allow draggable to work
          pointerEvents: "none",
          // background: "red",
          // opacity: 0.2,
        }}
      />
    );
  }

  return (
    <div
      ref={dropRef}
      className={`item ${props.isDragged ? "empty" : ""} ${props.size}`}
      style={{
        pointerEvents: "all",
        background: "black",
        opacity: 0, // increase to debug
        transition: "opacity 10s ease",
      }}
    />
  );
}

const animationMap = {
  DEFAULT_SPRINGY: { type: "spring" },
  LESS_SPRINGY: { type: "spring", bounce: 0.3 },
  LESS_SPRINGY_AND_FASTER: { duration: 0.4, type: "spring", bounce: 0.3 },
  // ----
  CUSTOM_SPRING_V1: { type: "spring", damping: 12, mass: 0.2, stiffness: 150 },
  // CUSTOM_SPRING_V1: { type: "spring", damping: 30, mass: 0.5, stiffness: 100 },
  NO_SPRING: { type: "tween" },
};

const animationValues = Object.keys(animationMap);

function Grid() {
  const [items, setItems] = useState(initialItems);
  const [draggingOverId, setDraggingOverId] = useState<ItemConfig["id"] | null>(
    null
  );
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

  const isDragging = Boolean(layer.item);
  const showDropArea = isDragging;

  const [animationKey, setAnimationKey] = useState<keyof typeof animationMap>(
    animationValues[3] as any
  );

  return (
    <MotionConfig transition={animationMap[animationKey]}>
      {/* <div className="container">
        <p>
          This is a drag 'n drop prototype. The main goal is to experiment with
          the <em>feel</em> of drag 'n drop.
        </p>
        <p>Please think about:</p>
        <ul>
          <li>Do you like the feel of the animations?</li>
          <li>Does the reordering feel intuitive?</li>
          <li>Do you like being able to drag the entire card?</li>
        </ul>
        <p>The buttons below can be used to add more items:</p>
        <button onClick={() => add("small", 0)}>add to start</button>
        <button onClick={() => add("small", items.length + 1)}>
          add to end
        </button>
        <br />
        <br />
        <p>Animation style:</p>
        <select
          value={animationKey}
          onChange={(ev) => {
            setAnimationKey(ev.target.value as any);
          }}
        >
          <option value={animationValues[0]}>{animationValues[0]}</option>
          <option value={animationValues[1]}>{animationValues[1]}</option>
          <option value={animationValues[2]}>{animationValues[2]}</option>
          <option value={animationValues[3]}>{animationValues[3]}</option>
          <option value={animationValues[4]}>{animationValues[4]}</option>
        </select>
        <br />
        <br />
        <br />
      </div> */}
      <div className="root container">
        <div className={`grid base ${layer.itemType ? "active" : ""}`}>
          <AnimatePresence key={"item"} initial={false}>
            {items.map((item) => {
              const isDragActive = Boolean(
                layer.item && layer.item.id === item.id
              );
              const isHovered = draggingOverId === item.id;

              return (
                <Fragment key={`item-${item.id}`}>
                  {/* This element is added to "take the place" of the current item */}
                  {isHovered && <motion.div className="item empty" />}
                  {/* // if item is being dragged, and it's not over it's initial position, remove it from the grid */}
                  {isDragActive && draggingOverId !== null ? null : (
                    <Item
                      isDragActive={isDragActive}
                      onEndDrag={() => setDraggingOverId(null)}
                      isHovered={isHovered}
                      changeSize={() => changeSize(item.id)}
                      remove={() => remove(item.id)}
                      {...item}
                    />
                  )}
                </Fragment>
              );
            })}
          </AnimatePresence>
        </div>
        {showDropArea && (
          <div className="grid dropgrid small">
            {items.map((item) => {
              const isDragActive = Boolean(
                layer.item && layer.item.id === item.id
              );
              const isHovered = draggingOverId === item.id;

              if (isDragActive && draggingOverId !== null) {
                return null;
              }

              return (
                <Drop
                  key={"drop-small" + item.id}
                  {...item}
                  size="small"
                  onHover={setDraggingOverId}
                  isDragged={isDragActive}
                  onDrop={(droppedId: string, droppedOnId: string) => {
                    const droppedIndex = items.findIndex(
                      ({ id }) => id === droppedId
                    );

                    const droppedOnIndex = items.findIndex(
                      ({ id }) => id === droppedOnId
                    );

                    if (droppedIndex !== -1 && droppedOnIndex !== -1) {
                      const updatedItems = [...items];
                      // remove dragged item from array
                      const removedItems = updatedItems.splice(droppedIndex, 1);
                      updatedItems.splice(
                        droppedOnIndex === 0
                          ? 0
                          : droppedIndex > droppedOnIndex
                          ? droppedOnIndex
                          : droppedOnIndex - 1,
                        0,
                        removedItems[0]
                      );
                      setItems(updatedItems);
                    }
                  }}
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
