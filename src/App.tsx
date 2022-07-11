import { useEffect, useRef, useState } from "react";
import { HTML5Backend, getEmptyImage } from "react-dnd-html5-backend";
import { DndProvider, useDrag, useDragLayer, useDrop } from "react-dnd";
import { AnimatePresence, isDragActive, motion } from "framer-motion";
import "./styles.css";
import { lerp } from "./helpers";

const BIG_DRAGGABLE = "chonk";
const SMALL_DRAGGABLE = "smol";

type ItemConfig = {
  id: string;
  size: "small" | "big";
};

const NUMBER_OF_ITEMS = 100;
const BIG_ITEMS_MAX = Math.ceil(NUMBER_OF_ITEMS / 4);

const initialItems = Array.from({ length: NUMBER_OF_ITEMS }).map(
  (_, index): ItemConfig => ({
    id: index.toString(),
    size: "small",
  })
);

const makeBig = (index: number) => {
  initialItems[index] = {
    id: index.toString(),
    size: "big",
  };
};

makeBig(0);
makeBig(7);

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

  // @ts-expect-error
  const maxDistanceScaleX = rect?.width * 2;
  // @ts-expect-error
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
    // @ts-expect-error
    <div className="item card" style={style}>
      {renderItem()}
    </div>
  );
};

function Item(props: ItemConfig & { isActive: boolean }) {
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

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, []);

  return (
    <motion.div
      id={getDraggableId(props.id)}
      ref={dragRef}
      className={`item card ${props.size}`}
      style={{
        transformOrigin: "top left",
        // background: props.isActive ? "red" : "white",
      }}
      initial={false}
      animate={{ scaleX: 1, opacity: dragProps.opacity }}
      transition={{ duration: 0.8, type: "spring" }}
      draggable={true}
      layout
    >
      <div
        className="body"
        style={{
          backgroundImage: `url(https://picsum.photos/400/400?r=${randomImageRef.current})`,
        }}
      />
      <div className="footer">{props.id}</div>
    </motion.div>
  );

  return (
    <AnimatePresence>
      {!dragProps.isDragActive && (
        <motion.div
          id={getDraggableId(props.id)}
          ref={dragRef}
          className={`item card ${props.size}`}
          style={{
            opacity: dragProps.opacity,
            transformOrigin: "top left",
            // background: props.isActive ? "red" : "white",
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: dragProps.opacity }}
          // exit={{ scaleX: 0, opacity: 0 }}
          transition={{ duration: 0.8, type: "spring" }}
          draggable={true}
          layout
        />
      )}
    </AnimatePresence>
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

  const layer = useDragLayer((monitor) => {
    return {
      itemType: monitor.getItemType(),
      item: monitor.getItem(),
    };
  });

  const add = (size: "small" | "big", position: number) => {
    const updatedItems = [...items];

    updatedItems.splice(position, 0, {
      id: "+" + addedCount,
      size,
    });

    addedCount++;

    setItems(updatedItems);
  };

  const remove = (position: number) => {
    console.log(position);
    const updatedItems = [...items];
    const foo = updatedItems.splice(position, position + 1);
    console.log(foo);
    setItems(updatedItems);
  };

  return (
    <>
      <button onClick={() => add("small", 0)}>add small p0</button>
      <button onClick={() => add("big", 0)}>add big p0</button>
      <button onClick={() => add("small", 3)}>add small p3</button>
      <button onClick={() => add("big", 3)}>add big p3</button>
      <button onClick={() => add("big", 3)}>add big p3</button>
      <br />
      <br />
      <button onClick={() => remove(0)}>remove p0</button>
      <button onClick={() => remove(1)}>remove p1</button>
      <button onClick={() => remove(2)}>remove p2</button>
      <button onClick={() => remove(3)}>remove p3</button>
      <button onClick={() => remove(4)}>remove p4</button>
      <br />
      <br />
      <div className="root">
        <CustomDragLayer />
        <div className={`grid ${layer.itemType ? "active" : ""}`}>
          {items.map((item) => {
            return (
              <Item
                key={"item" + item.id}
                isActive={layer.item && layer.item.id === item.id}
                {...item}
              />
            );
          })}
        </div>
        <div className="grid dropzone small">
          {items.map((item) => {
            return <Drop key={"drop-small" + item.id} {...item} size="small" />;
          })}
        </div>
        <div className="grid dropzone big">
          {[...items].splice(0, BIG_ITEMS_MAX).map((item) => {
            return <Drop key={"drop-big" + item.id} {...item} size="big" />;
          })}
        </div>
      </div>
    </>
  );
}

export default function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      <Grid />
    </DndProvider>
  );
}
