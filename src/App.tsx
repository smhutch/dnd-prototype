import { useCallback, useEffect, useRef, useState } from "react";
import { HTML5Backend, getEmptyImage } from "react-dnd-html5-backend";
import { DndProvider, useDrag, useDragLayer, useDrop } from "react-dnd";
import {
  AnimatePresence,
  isDragActive,
  LayoutGroup,
  motion,
} from "framer-motion";
import "./styles.css";
import { lerp } from "./helpers";
import cuid from "cuid";
import Chance from "chance";

const chance = new Chance();

const BIG_DRAGGABLE = "chonk";
const SMALL_DRAGGABLE = "smol";

type ItemConfig = {
  id: string;
  name: string;
  size: "small" | "big";
};

const RATIO = [1, 0.2]; // [small, big]
const NUMBER_OF_ITEMS = 100;
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
  function renderItem() {
    switch (layer.itemType) {
      case BIG_DRAGGABLE:
        return <div>Big</div>;
      case SMALL_DRAGGABLE:
        return <div>Small</div>;
      default:
        return null;
    }
  }
  if (!layer.isDragging) {
    return null;
  }

  const root = document.querySelector(".root");
  const el = document.getElementById(getDraggableId(layer.item.id));

  const rootRect = root?.getBoundingClientRect();
  const rect = el?.getBoundingClientRect();

  if (!rect) {
    return null;
  }

  // console.log(rect);

  // @ts-expect-error
  const initialX = layer.initialSourceClientOffset.x;
  // @ts-expect-error
  const initialY = layer.initialSourceClientOffset.y;

  // @ts-expect-error
  const ox = initialX - layer.initialSourceClientOffset.x;
  // @ts-expect-error
  const oy = initialY - layer.initialSourceClientOffset.y;

  // @ts-expect-error
  const x = layer.sourceClientOffset.x - rootRect?.left;
  // @ts-expect-error
  const y = layer.sourceClientOffset.y - rootRect?.top;

  const maxDistanceScaleX = rect?.width * 2;
  const maxDistanceScaleY = rect?.height * 2;

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

  const ROTATION_LIMIT = 4;
  const rotation =
    dxp > 0
      ? lerp(0, ROTATION_LIMIT, Math.abs(dxp))
      : lerp(0, -ROTATION_LIMIT, Math.abs(dxp));

  const transform = [
    `translate(${x}px, ${y}px)`,
    `rotate(${rotation}deg)`,
    `scale(${scale})`,
  ].join(" ");

  const style = {
    height: rect?.height,
    width: rect?.width,
    maxWidth: rect?.width,
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
    opacity: 1,
    transition: "0.2 ease transform",
    transform,
    cursor: "grabbing",
    boxShadow: "0 0 0 4px black",
  };

  return (
    <div
      className="item card"
      // @ts-expect-error
      style={style}
    >
      {renderItem()}
    </div>
  );
};

function Item(
  props: ItemConfig & {
    changeSize(): void;
    remove(): void;
    isDragActive: boolean;
    isInitialAnimationEnabled: boolean;
  }
) {
  const randomImageRef = useRef<number>(Math.random());

  const [dragProps, dragRef, preview] = useDrag(
    () => ({
      type: props.size === "small" ? SMALL_DRAGGABLE : BIG_DRAGGABLE,
      item: props,
      collect: (monitor) => ({
        opacity: monitor.isDragging() ? 0.2 : "unset",
        isDragActive: monitor.isDragging(),
      }),
    }),
    []
  );

  const [dropProps, dropRef] = useDrop(
    () => ({
      accept: props.size === "small" ? SMALL_DRAGGABLE : BIG_DRAGGABLE,
      collect: (monitor) => {
        const a = [monitor.canDrop()];
        // console.log(a);

        return {
          enabled: monitor.canDrop(),
          opacity: monitor.isOver() ? 1 : a[0] ? 0 : 0,
        };
      },
    }),
    []
  );

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, []);

  const animationVariants = {
    hidden: { opacity: 0, scaleX: 0 },
    show: { opacity: 1, scaleX: 1 },
  };

  const IMAGE_SIZE = 1200;

  return (
    <motion.div
      id={getDraggableId(props.id)}
      ref={dragRef}
      className={`item card ${props.size}`}
      style={{
        transformOrigin: "top left",
      }}
      initial={
        props.isInitialAnimationEnabled ? animationVariants.hidden : false
      }
      // animate={props.isDragActive ? "hidden" : "show"}
      exit={{
        ...animationVariants.hidden,
        // transformOrigin: "top left",
      }}
      animate="show"
      variants={animationVariants}
      transition={{ duration: 0.8, type: "tween", ease: "easeInOut" }}
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
          backgroundImage: `url(https://picsum.photos/${IMAGE_SIZE}/${IMAGE_SIZE}?r=${randomImageRef.current})`,
        }}
      />
      <div className="footer">{props.name}</div>
    </motion.div>
  );
}

function Drop(props: ItemConfig) {
  const [dropProps, dropRef] = useDrop(
    () => ({
      accept: props.size === "small" ? SMALL_DRAGGABLE : BIG_DRAGGABLE,
      collect: (monitor) => {
        const a = [monitor.canDrop()];
        // console.log(a);

        return {
          enabled: monitor.canDrop(),
          opacity: monitor.isOver() ? 1 : a[0] ? 0 : 0,
        };
      },
    }),
    []
  );

  return (
    <div
      ref={dropRef}
      className={`item drop ${props.size}`}
      style={{
        opacity: props.size === "big" ? dropProps.opacity : dropProps.opacity,
        pointerEvents: dropProps.enabled ? "auto" : "none",
        background: "transparent",
        transition: "opacity 0.2s ease",
      }}
    />
  );
}

let addedCount = 1;
function Grid() {
  const [items, setItems] = useState(initialItems);
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

    addedCount++;

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

  const isMounted = useIsMounted();

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
        <LayoutGroup>
          <CustomDragLayer />
          <div className={`grid ${layer.itemType ? "active" : ""}`}>
            <AnimatePresence key={"item"}>
              {items.map((item) => {
                const isDragActive = layer.item && layer.item.id === item.id;

                return (
                  <Item
                    key={`item-${item.id}`}
                    isDragActive={isDragActive}
                    isInitialAnimationEnabled={isMounted()}
                    changeSize={() => changeSize(item.id)}
                    remove={() => remove(item.id)}
                    {...item}
                  />
                );
              })}
            </AnimatePresence>
          </div>
          <div className="grid dropzone small">
            {items.map((item) => {
              return (
                <Drop key={"drop-small" + item.id} {...item} size="small" />
              );
            })}
          </div>
          <div className="grid dropzone big">
            {[...items].splice(0, BIG_ITEMS_MAX).map((item) => {
              return <Drop key={"drop-big" + item.id} {...item} size="big" />;
            })}
          </div>
        </LayoutGroup>
      </div>
    </>
  );
}

function useIsMounted() {
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  return useCallback(() => isMounted.current, []);
}

export default function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      <Grid />
    </DndProvider>
  );
}
