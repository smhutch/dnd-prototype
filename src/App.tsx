import { useEffect, useState } from "react";
import { HTML5Backend, getEmptyImage } from "react-dnd-html5-backend";
import { DndProvider, useDrag, useDragLayer, useDrop } from "react-dnd";
import { motion } from "framer-motion";
import lerp from "lerp";
import "./styles.css";

const BIG_DRAGGABLE = "chonk";
const SMALL_DRAGGABLE = "smol";

type ItemConfig = {
  index: number;
  size: "small" | "big";
};

const NUMBER_OF_ITEMS = 100;
const BIG_ITEMS_MAX = Math.ceil(NUMBER_OF_ITEMS / 4);

const initialItems = Array.from({ length: NUMBER_OF_ITEMS }).map(
  (_, index): ItemConfig => ({
    index: index,
    size: "small"
  })
);

const makeBig = (index: number) => {
  initialItems[index] = {
    index,
    size: "big"
  };
};

makeBig(0);
makeBig(7);

export const CustomDragLayer = (props) => {
  const dl = useDragLayer((monitor) => {
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
      diff: monitor.getDifferenceFromInitialOffset()
    };
  });
  function renderItem() {
    switch (dl.itemType) {
      case BIG_DRAGGABLE:
        return <div>{dl.item.index}</div>;
      case SMALL_DRAGGABLE:
        return <div>{dl.item.index}</div>;
      default:
        return null;
    }
  }
  if (!dl.isDragging) {
    return null;
  }

  const root = document.querySelector(".root");
  const el = document.getElementById("hack-" + dl.item.index);

  const BODY_PADDING_Y = 32;

  const rootRect = root?.getBoundingClientRect();
  const rect = el?.getBoundingClientRect();

  // something is slightly off here
  // source client offset =
  const initialX = dl.initialSourceClientOffset.x;
  const initialY = dl.initialSourceClientOffset.y;

  const ox = initialX - dl.initialSourceClientOffset.x;
  const oy = initialY - dl.initialSourceClientOffset.y;

  // const x = dl.initialSourceClientOffset.x + dl.differenceFromInitialOffset.x;
  // TODO: why is this different from the line above??
  // const y = dl.initialSourceClientOffset.y + dl.differenceFromInitialOffset.y;
  const x = dl.sourceClientOffset.x - rootRect?.left;
  const y = dl.sourceClientOffset.y - rootRect?.top;

  // const distanceFromTop =
  //   dl.initialSourceClientOffset.y + dl.initialClientOffset.y;

  // console.log(dl.initialSourceClientOffset.y, distanceFromTop);

  // console.log(dl.initialClientOffset);
  // console.log(rect, dl.initialSourceClientOffset);
  // console.log(dl.clientOffset);
  // console.log(dl.differenceFromInitialOffset);
  // console.log(dl.sourceClientOffset);

  const maxDistanceScaleX = rect?.width * 2;
  const maxDistanceScaleY = rect?.height * 2;

  const SCALE_MAX = 0.5;
  const dxp =
    Math.min(maxDistanceScaleX, dl.differenceFromInitialOffset.x) /
    maxDistanceScaleX;
  // const dxy =
  //   Math.min(maxDistanceScaleY, dl.differenceFromInitialOffset.y) /
  //   maxDistanceScaleY;
  const dxy =
    Math.min(maxDistanceScaleY, dl.differenceFromInitialOffset.y) /
    maxDistanceScaleY;

  // this isn't right
  let scale = lerp(1, SCALE_MAX, Math.abs(dxp * dxy));
  // scale = 1;

  // math is off here
  // console.log(dxp);
  const ROTATION_LIMIT = 4;
  const rotation =
    dxp > 0
      ? lerp(0, ROTATION_LIMIT, Math.abs(dxp))
      : lerp(0, -ROTATION_LIMIT, Math.abs(dxp));
  // const rotation = 0;

  const transform = [
    `translate(${x}px, ${y}px)`,
    `rotate(${rotation}deg)`,
    `scale(${scale})`
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
    boxShadow: "0 0 0 4px black"
  };

  return (
    <div
      className="item card"
      style={{
        ...style
      }}
    >
      {renderItem()}
    </div>
  );
};

function Item(props: ItemConfig) {
  const [dragProps, dragRef, preview] = useDrag(
    () => ({
      type: props.size === "small" ? SMALL_DRAGGABLE : BIG_DRAGGABLE,
      item: props,
      // isDragging: (m) => m.getItem().index === props.index,
      collect: (monitor) => ({
        opacity: monitor.isDragging() ? 0.5 : "unset"
      })
    }),
    []
  );

  console.log(dragProps.isDragging, props.index, props.activeItem);

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, []);

  // use a similar trick here for isDraggingOver.
  // might need to be two parts for dragging big and dragging small items
  const isActiveItem =
    props.activeItem && props.activeItem.index === props.index;

  return (
    <motion.div
      id={`hack-${props.id}`}
      ref={dragRef}
      className={`item card ${props.size}`}
      style={{
        opacity: dragProps,
        transformOrigin: "top left"
      }}
      initial={{ scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ duration: 0.8, type: "spring" }}
      draggable={true}
      layout
    >
      {props.index}
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
          opacity: monitor.isOver() ? 1 : a[0] ? 0 : 0
        };
      }
    }),
    []
  );

  return (
    <div
      id={`hack-${props.index}`}
      ref={dropRef}
      className={`item drop ${props.size}`}
      style={{
        opacity: props.size === "big" ? dropProps.opacity : dropProps.opacity,
        pointerEvents: dropProps.enabled ? "auto" : "none",
        background: "transparent",
        transition: "opacity 0.2s ease"
      }}
    />
  );
}

function Grid() {
  const [items, setItems] = useState(initialItems);

  const layer = useDragLayer((monitor) => {
    return {
      itemType: monitor.getItemType(),
      item: monitor.getItem()
    };
  });

  // useEffect(() => {
  //   console.log(ddm);
  // }, []);

  // console.log(ddm);
  // const monitor = ddm.getMonitor();
  // console.log(monitor);
  // const isDraggingBig = monitor.isDraggingSource(BIG_DRAGGABLE);
  // const isDraggingSmall = monitor.isDraggingSource(SMALL_DRAGGABLE);

  // console.log(isDraggingBig, isDraggingSmall);

  return (
    <div className="root">
      <CustomDragLayer />
      <div className={`grid ${layer.itemType ? "active" : ""}`}>
        {items.map((item) => {
          return <Item activeItem={layer.item} {...item}></Item>;
        })}
      </div>
      <div className="grid dropzone small">
        {items.map((item) => {
          return <Drop {...item} size="small" />;
        })}
      </div>
      <div className="grid dropzone big">
        {[...items].splice(0, BIG_ITEMS_MAX).map((item) => {
          return <Drop {...item} size="big" />;
        })}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      <h1>Remove item example</h1>
      <Grid />
    </DndProvider>
  );
}
