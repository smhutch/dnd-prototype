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
import { debounce, lerp } from "./helpers";
import cuid from "cuid";
import Chance from "chance";
import { mergeRefs } from "react-merge-refs";
import { useDebounce } from "@react-hook/debounce";

const chance = new Chance();

const BIG_DRAGGABLE = "BIG";
const SMALL_DRAGGABLE = "SMALL";

type DraggedItemType = typeof BIG_DRAGGABLE | typeof SMALL_DRAGGABLE;

let imageId = 1;
const getImageUrl = () => {
  const url = `/artwork/${imageId}.jpg`;
  imageId++;

  return url;
};

type ItemSize = "big" | "small";

type ItemConfig = {
  id: string;
  imageUrl: string;
  username: string;
  size: ItemSize;
};

// ----
const RATIO = [1, 0]; // [small, big]
const NUMBER_OF_ITEMS = 24;

const makeItem = (size: ItemSize): ItemConfig => ({
  id: cuid(),
  imageUrl: getImageUrl(),
  size,
  username: "@adam",
});

const initialItems = Array.from({ length: NUMBER_OF_ITEMS }).map(
  (_, index): ItemConfig => {
    if (index === 0) {
      return makeItem("big");
    }

    return makeItem(chance.weighted(["small", "big"], RATIO));
  }
);
// .reverse();

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
      {layer.item && (
        <motion.div
          style={{
            ...styles,
            pointerEvents: "none",
          }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
          }}
          transition={{
            type: "spring",
            damping: 12,
            mass: 0.2,
            stiffness: 150,
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

type DropIndicatorPosition = "BEFORE" | "AFTER";

type DebugLogOption = {
  draggedIndex: number;
  hoveringOverIndex: number;
  position: DropIndicatorPosition;
};

type Draggable = {
  index: number;
  id: string;
  imageUrl: string;
  username: string;
  size: ItemSize;
};

type OnDragHoverOption =
  | {
      position: DropIndicatorPosition;
      index: Draggable["index"];
    }
  | {
      position: DropIndicatorPosition;
      id: Draggable["id"];
    };

type Callback = () => void;
type OnDragHover = (draggedOverOption: OnDragHoverOption) => void;

const debugLog = (message: string, options: DebugLogOption) => {
  if (!DEBUG_MODE) return;
  console.debug("dnd", message, options);
};

function ArtworkCard(
  props: ItemConfig & {
    changeSize(): void;
    draggedItemRect: DOMRect | null;
    dropIndicator: any;
    dropIndicatorPosition: any;
    enableMoveOnHover: boolean;
    gridRect: DOMRect | null;
    index: number;
    isDropIndicatorVisible: boolean;
    isHovered: boolean;
    isPickedUp: boolean;
    onEndDrag: Callback;
    onHoverWhileDragging: OnDragHover;
    onLayoutAnimationComplete: Callback;
    onLayoutAnimationStart: Callback;
    remove: Callback;
    setDraggedItemRect(a: any): void;
    draggedItem: Draggable | undefined;
    draggedItemRef: any;
  }
) {
  const rootRef = useRef<HTMLDivElement>(null);

  const rootRect = rootRef.current
    ? rootRef.current.getBoundingClientRect()
    : null;

  const [_dragProps, dragRef, preview] = useDrag<Draggable>(
    () => ({
      type: props.size === "small" ? SMALL_DRAGGABLE : BIG_DRAGGABLE,
      item: {
        index: props.index,
        id: props.id,
        imageUrl: props.imageUrl,
        username: props.username,
        size: props.size,
      },
      end: () => {
        props.onEndDrag();
      },
    }),
    [props.onEndDrag]
  );

  const [dropProps, dropRef] = useDrop<Draggable, unknown, { over: boolean }>(
    () => ({
      accept: [SMALL_DRAGGABLE, BIG_DRAGGABLE],
      collect: (monitor) => {
        return {
          over: monitor.isOver(),
        };
      },
      canDrop: () => {
        return props.enableMoveOnHover;
      },
      hover: (draggedItem, monitor) => {
        const { draggedItemRect, gridRect } = props;

        if (!props.enableMoveOnHover) return;
        if (!draggedItemRect) return;
        if (!rootRect) return;

        const id = props.id;
        const pointer = monitor.getClientOffset();

        const sourcePosition = monitor.getInitialSourceClientOffset();
        const initialPointer = monitor.getInitialClientOffset();

        const debugHoverLog = (message: string, position: "BEFORE" | "AFTER") =>
          debugLog(message, {
            draggedIndex: draggedItem.index,
            hoveringOverIndex: props.index,
            position,
          });

        if (!pointer || !initialPointer || !sourcePosition || !gridRect) return;

        if (props.size === "big") {
          // const centerX = rootRect.left + rootRect.width / 2;
          // const centerY = rootRect.top + rootRect.height / 2;
          // const half = pointer.x < centerX ? "left" : "right";
          // const side = pointer.y < centerY ? "top" : "bottom";

          // if (pointer.x < initialPointer.x) {
          //   if (half === "left" && side === "top") {
          //     return props.onHoverWhileDragging({
          //       position: "BEFORE",
          //       index: props.index,
          //     });
          //   }
          //   return;
          // }

          // if (pointer.x > initialPointer.x) {
          //   if (half === "right" && side === "top") {
          //     return props.onHoverWhileDragging({
          //       position: "AFTER",
          //       index: props.index,
          //     });
          //   }
          //   return;
          // }

          return;
        }

        if (draggedItem.size === "big") {
          // if (draggedItem.index < props.index) {
          //   console.log("edge case...");
          // }
          // const draggedItemCenterX =
          //   draggedItemRect.left + draggedItemRect.width / 2;
          // const draggedItemCenterY =
          //   draggedItemRect.top + draggedItemRect.height / 2;
          // const centerX = rootRect.left + rootRect.width / 2;
          // const centerY = rootRect.top + rootRect.height / 2;
          // console.log(
          //   draggedItemRect.top,
          //   draggedItemRect.bottom,
          //   rootRect.top
          // );
          // const draggedItemMiddleY =
          //   draggedItemRect.top + draggedItemRect.height / 2;
          // console.log(
          //   rootRect.bottom <= draggedItemRect.bottom,
          //   rootRect.bottom,
          //   draggedItemRect.bottom,
          //   Math.ceil(draggedItemRect.bottom)
          // );
          // /**
          //  * If the user is dragging a LARGE item horizontally,
          //  * and they are hovering over a SMALL item in the bottom half of the original position
          //  */
          // if (
          //   rootRect.top > draggedItemMiddleY &&
          //   Math.ceil(rootRect.bottom) <= Math.ceil(draggedItemRect.bottom)
          // ) {
          //   /**
          //    * If the user is dragging to the right
          //    */
          //   if (pointer.x > initialPointer.x) {
          //     return props.onHoverWhileDragging({
          //       position: "BEFORE",
          //       index: props.index - 1,
          //     });
          //   } else {
          //     // return props.onHoverWhileDragging({
          //     // })
          //   }
          // }
        }

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
          return props.onHoverWhileDragging({ position: POSITION, id });
        }

        if (draggedItem.size === "big") {
          /**
           * When dropzone is touching the right side, there is no space
           * for the user to drop the item in that position. To account for this,
           * we need to handle this case separately.
           */
          const isDropzoneTouchingRightEdge =
            Math.ceil(rootRect.right) === Math.ceil(gridRect.right);

          if (props.index < draggedItem.index) {
            /**
             * When moving a LARGE item upwards, and hovering over the item at the right side,
             * assume that the user wants the right side of the large item to be in this position.
             *
             * With this assumption in place, we can drop the large item in the space ONE to the left.
             */
            if (isDropzoneTouchingRightEdge) {
              return props.onHoverWhileDragging({
                position: "BEFORE",
                index: props.index - 1,
              });
            }

            debugHoverLog("FIRST", "BEFORE");
            return props.onHoverWhileDragging({ position: "BEFORE", id });
          } else {
            console.log(props.index - draggedItem.index);

            if (props.index - draggedItem.index <= 2) {
              return props.onHoverWhileDragging({
                position: "AFTER",
                index: props.index,
              });
            }

            debugHoverLog("FIRST", "AFTER");
            return props.onHoverWhileDragging({
              position: "AFTER",
              index: props.index - 2,
            });
          }
        }

        if (props.dropIndicator && props.dropIndicator.position) {
          /**
           * If a dropzone is already displayed for the current item, and the ....
           */
          if (props.dropIndicator.id === props.id) {
            const POSITION =
              props.dropIndicator.position === "AFTER" ? "BEFORE" : "AFTER";

            debugHoverLog("TOGGLE", POSITION);
            return props.onHoverWhileDragging({ position: POSITION, index: 7 });
          }

          /**
           * If the current inticator is AFTER the current item, the user must be moving the dragged item
           * to the left, so we need to show the indicator before the current item.
           */
          if (props.dropIndicator.index > props.index) {
            debugHoverLog("MOVE", "BEFORE");
            return props.onHoverWhileDragging({ position: "BEFORE", id });
          }

          /**
           * If the current inticator is AFTER the current item, the user must be moving the dragged item
           * to the left, so we need to show the indicator before the current item.
           */
          if (props.dropIndicator.index < props.index) {
            debugHoverLog("MOVE", "AFTER");
            return props.onHoverWhileDragging({ position: "AFTER", id });
          }
        }

        if (props.index < draggedItem.index) {
          debugHoverLog("FIRST", "BEFORE");
          return props.onHoverWhileDragging({ position: "BEFORE", id });
        } else {
          debugHoverLog("FIRST", "AFTER");
          return props.onHoverWhileDragging({ position: "AFTER", id });
        }
      },
    }),
    [
      props.enableMoveOnHover,
      props.draggedItemRect,
      props.dropIndicatorPosition,
      props.dropIndicator,
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
    /**
     * When dragging over another item, remove this element from the DOM
     */
    if (props.isDropIndicatorVisible) {
      return null;
    } else {
      /**
       * When this item is picked up, but the user is not dragging over another item yet,
       * show a grey box in place of the picked up item.
       *
       * This visually appears to be identical to a drop area, but is technically different (dropping here doesn't reorder the grid)
       *
       */
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
        height: "100%",
      }}
      initial={animationVariants.hidden}
      animate={props.isPickedUp ? "dragging" : "show"}
      onLayoutAnimationStart={() => props.onLayoutAnimationStart()}
      onLayoutAnimationComplete={() => props.onLayoutAnimationComplete()}
      variants={animationVariants}
      draggable
      onDragStart={() => {
        /**
         * When starting the drag, keep track of the initial position of the dragged item.
         * This is later used to detect if the user is dragging over the spot they picked up
         * this item from, to allow them to put it back down in the same spot
         */
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
          position: "absolute",
          inset: 0,
          display: props.draggedItem ? "block" : "none",
          ...(DEBUG_MODE
            ? {
                // background: "black",
                opacity: 0.2,
              }
            : {}),
        }}
      />
    </motion.div>
  );
}

type DropProps = {
  onDrop: (drag: Draggable) => void;
  size: ItemSize;
};

function Drop(props: DropProps) {
  const [_dropProps, dropRef] = useDrop<Draggable>(
    () => ({
      accept: [SMALL_DRAGGABLE, BIG_DRAGGABLE],
      drop: (dragItem) => {
        props.onDrop(dragItem);
      },
    }),
    []
  );

  return (
    <motion.div ref={dropRef} className={`item empty ${props.size}`} layout />
  );
}

type DragLayerProps = {
  itemType: DraggedItemType | null;
  item: Draggable;
};

function Grid() {
  const [items, setItems] = useState(initialItems);
  const [draggedItemRect, setDraggedItemRect] = useState<DOMRect | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    id: ItemConfig["id"];
    position: "BEFORE" | "AFTER";
  } | null>(null);
  const draggedItemRef = useRef<any>(null);

  const layer = useDragLayer((monitor): DragLayerProps => {
    return {
      itemType: monitor.getItemType() as DraggedItemType | null,
      item: monitor.getItem(),
    };
  });

  // const add = (size: ItemSize, position: number) => {
  //   const updatedItems = [...items];
  //   updatedItems.splice(position, 0, makeItem(size));
  //   setItems(updatedItems);
  // };

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

  const gridRectRef = useRef<DOMRect | null>(null);

  const getGridRect = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    gridRectRef.current = el.getBoundingClientRect();
  }, []);

  const [enableMoveOnHover, setEnableMoveOnHover] = useState(true);

  return (
    <MotionConfig
      transition={{ type: "spring", damping: 12, mass: 0.2, stiffness: 150 }}
    >
      <div className="root container">
        <div
          ref={getGridRect}
          className={`grid base ${layer.itemType ? "active" : ""}`}
        >
          <AnimatePresence key={"item"} initial={false}>
            {items.map((item, index) => {
              /**
               * Is this item being dragged?
               */
              const isPickedUp = Boolean(
                layer.item && layer.item.id === item.id
              );

              const isDropIndicatorVisible = Boolean(dropIndicator);
              const isHovered = dropIndicator
                ? dropIndicator.id === item.id
                : false;

              const dropIndicatorPosition = dropIndicator?.position;

              const onDrop = (
                dropPosition: "BEFORE" | "AFTER",
                draggedItem: Draggable
              ) => {
                /**
                 * Original index of the dragged item.
                 */
                const draggedIndex = draggedItem.index;
                /**
                 * Index of the item that the user dragged over, to reveal a drop area.
                 */
                const droppedIndex = index;

                const isOneAfter = draggedIndex === index + 1;
                const isOneBefore = draggedIndex === index - 1;

                if (
                  (dropPosition === "AFTER" && isOneAfter) ||
                  (dropPosition === "BEFORE" && isOneBefore)
                ) {
                  // No need to mutate, the item is already in the correct position
                  return;
                }

                if (draggedIndex !== -1) {
                  const position = getDropPosition({
                    dropPosition,
                    draggedIndex,
                    droppedIndex,
                  });

                  const updatedItems = [...items];
                  // remove dragged item from array
                  const removedItems = updatedItems.splice(draggedIndex, 1);
                  // insert dragged item at new index
                  updatedItems.splice(position, 0, removedItems[0]);
                  setItems(updatedItems);
                }
              };

              return (
                <Fragment key={`item-${item.id}`}>
                  {isHovered && dropIndicator?.position === "BEFORE" && (
                    <Drop
                      size={layer.item?.size}
                      onDrop={(droppedItem) => onDrop("BEFORE", droppedItem)}
                    />
                  )}
                  {/* if item has been picked up, but is being dragged over another item, remove the source item from the grid */}
                  {isPickedUp &&
                  dropIndicator &&
                  dropIndicator.id !== null ? null : (
                    <ArtworkCard
                      changeSize={() => changeSize(item.id)}
                      draggedItem={layer.item}
                      draggedItemRect={draggedItemRect}
                      draggedItemRef={draggedItemRef}
                      dropIndicator={dropIndicator}
                      dropIndicatorPosition={dropIndicatorPosition}
                      enableMoveOnHover={enableMoveOnHover}
                      gridRect={gridRectRef.current}
                      index={index}
                      isDropIndicatorVisible={isDropIndicatorVisible}
                      isHovered={isHovered}
                      isPickedUp={isPickedUp}
                      onEndDrag={() => {
                        setDropIndicator(null);
                      }}
                      onHoverWhileDragging={(arg) => {
                        if (!enableMoveOnHover) return;

                        if ("id" in arg) {
                          setDropIndicator(arg);
                        }

                        if ("index" in arg) {
                          const item = items[arg.index];
                          if (!item) return;

                          const id = item.id;

                          setDropIndicator({
                            id,
                            position: arg.position,
                          });
                        }
                      }}
                      onLayoutAnimationComplete={() =>
                        setEnableMoveOnHover(true)
                      }
                      onLayoutAnimationStart={() => setEnableMoveOnHover(false)}
                      remove={() => remove(item.id)}
                      setDraggedItemRect={setDraggedItemRect}
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

type GetDropPositionOptions = {
  /** Does the user want to drop the item before or after the item they hovered over? */
  dropPosition: "BEFORE" | "AFTER";
  /** The index of the item that the user hovered over while dragging */
  droppedIndex: number;
  /** The original index of the dragged item */
  draggedIndex: number;
};

export const getDropPosition = (options: GetDropPositionOptions): number => {
  const { dropPosition, droppedIndex, draggedIndex } = options;

  /** Is the dragged item being moved to a new index that is greater than the current position? */
  const isMovingToLargerIndex = droppedIndex > draggedIndex;

  if (isMovingToLargerIndex) {
    /**
     * When dragging an item to a larger index, the dropPosition is initially 'AFTER' the item.
     *
     * ⧅ = drop indicator
     * 0 = index in grid
     *
     * Initial (about to drag item 0):
     * 0 1 2 3
     * 4 5 6 7
     *
     * While dragging item 0 over item 2:
     * 1 2 ⧅ 3
     * 4 5 6 7
     *
     * While dragging item 5 over item 7:
     * 0 1 2 3
     * 4 6 7 ⧅
     *
     * The dropPosition will become 'BEFORE' in scenarios where the user dragged over an item for a second time.
     * They initially saw a drop indicator `AFTER` the item, but then changed their mind, and dragged over the item again,
     * causing the drop indicator to move `BEFORE` the item.
     *
     * While dragging item 0 over item 2 a second time:
     * 1 ⧅ 2 3
     * 4 5 6 7
     *
     * While dragging item 5 over item 7 a second time:
     * 0 1 2 3
     * 4 6 ⧅ 7
     */
    return dropPosition === "AFTER" ? droppedIndex : droppedIndex - 1;
  }

  /**
   * In this scenario, the dragged item is being moved to a smaller index.
   * The drop indicator will initially have a position `BEFORE` the item.
   *
   * While dragging item 3 over item 1:
   * 0 ⧅ 1 2
   * 4 5 6 7
   *
   * While dragging item 4 over item 2:
   * 0 1 ⧅ 2
   * 3 4 6 7
   *
   * The dropPosition will become 'AFTER' in scenarios where the user dragged over an item for a second time.
   * This is essentially the opposite logic to the above scenario.
   *
   * While dragging item 3 over item 1 a second time:
   * 0 1 ⧅ 2
   * 4 5 6 7
   *
   * While dragging item 4 over item 2 a second time:
   * 0 1 2 ⧅
   * 3 4 6 7
   */
  return dropPosition === "AFTER" ? droppedIndex + 1 : droppedIndex;
};
