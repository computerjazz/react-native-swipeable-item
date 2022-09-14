# React Native Swipeable Item

A swipeable component with underlay for React Native.<br />
Fully native interactions powered by [Reanimated](https://github.com/kmagiera/react-native-reanimated) and [React Native Gesture Handler](https://github.com/kmagiera/react-native-gesture-handler)

Compatible with [React Native Draggable Flatlist](https://github.com/computerjazz/react-native-draggable-flatlist)

![Swipeable Item demo](https://i.imgur.com/fFCnQ0n.gif)

## Install

1. Follow installation instructions for [reanimated](https://github.com/kmagiera/react-native-reanimated) and [react-native-gesture-handler](https://github.com/kmagiera/react-native-gesture-handler)
2. `npm install` or `yarn add` `react-native-swipeable-item`
3. `import SwipeableItem from 'react-native-swipeable-item'`

### Props

_NOTE:_ Naming is hard. When you swipe _right_, you reveal the item on the _left_. So what do you name these things? I have decided to name everything according to swipe direction. Therefore, a swipe left reveals the `renderUnderlayLeft` component. Not perfect but it works.

| Name                  | Type                                                                    | Description                                                                                                                                                              |
| :-------------------- | :---------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `renderUnderlayLeft`  | `RenderUnderlay`                                                        | Component to be rendered underneath row on left swipe.                                                                                                                   |
| `renderUnderlayRight` | `RenderUnderlay`                                                        | Component to be rendered underneath row on right swipe.                                                                                                                  |
| `snapPointsLeft`      | `number[]`                                                              | Pixel values left-swipe snaps to (eg. `[100, 300]`)                                                                                                                      |
| `snapPointsRight`     | `number[]`                                                              | Pixel values right-swipe snaps to (eg. `[100, 300]`)                                                                                                                     |
| `renderOverlay`       | `RenderOverlay`                                                         | Component to be rendered on top. Use if you need access to programmatic open/close methods. May altenatively pass children to SwipeableItem.                             |
| `onChange`            | `(params: { openDirection: OpenDirection, snapPoint: number }) => void` | Called when row is opened or closed.                                                                                                                                     |
| `swipeEnabled`        | `boolean`                                                               | Enable/disable swipe. Defaults to `true`.                                                                                                                                |
| `activationThreshold` | `number`                                                                | Distance finger must travel before swipe engages. Defaults to 20.                                                                                                        |
| `swipeDamping`        | `number`                                                                | How much swipe velocity determines snap position. A smaller number means swipe velocity will have a larger effect and row will swipe open more easily. Defaults to `10`. |

### Hooks

| Name                     | Type                                                                                           | Description                                                                                                                                                                                                          |
| :----------------------- | :--------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useSwipeableItemParams` | `() => OverlayParams<T> & { open: OpenPromiseFn, percentOpen: Animated.DerivedValue<number> }` | Utility hook that reutrns the same params as the render functions are called with. `open()` and `percentOpen` params reflect the context in which the hook is called (i.e. within an underlay or overlay component). |
|                          |

```tsx
function MyUnderlayComponent() {
  // Underlay components "know" which direction to open, so we don't need to call `openLeft()` or `openRight()`, we can just call 'open()'
  // Underlay components also receive the `percentOpen` value of their own direction (`percentOpenLeft` or `percentOpenRight`)
  const swipeableItemParams = useSwipeableItemParams();
  return <TouchableOpacity onPress={swipeableItemParams.open} />;
}

function MyOverlayComponent() {
  // Overlay components get the same params, but have defaults filled in for `open()` and `percentOpen` params.
  const swipeableItemParams = useSwipeableItemParams();
  return <TouchableOpacity onPress={swipeableItemParams.openLeft} />;
}
```

### Instance Methods

| Name    | Type                                                                                                                | Description                                                  |
| :------ | :------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------- |
| `open`  | `(OpenDirection.LEFT \| OpenDirection.RIGHT, snapIndex?: number, options?: { animated: boolean }) => Promise<void>` | Imperatively open left or right. Promise resolves once open. |
| `close` | `(options?: { animated?: boolean}) => Promise<void>`                                                                | Close all. Promise resolves once closed.                     |

```tsx
// Imperative open example
const itemRef = useRef<SwipeableItemImperativeRef>(null)

...

<SwipeableItem ref={itemRef} />

...
itemRef.current?.open(OpenDirection.LEFT)
```

### Types

```ts
type OpenCloseOptions = { animated?: boolean };
type OpenPromiseFn = (
  snapPoint?: number,
  options?: OpenCloseOptions
) => Promise<void>;
type ClosePromiseFn = (options?: OpenCloseOptions) => Promise<void>;

export type UnderlayParams<T> = {
  item: T;
  open: OpenPromiseFn;
  close: ClosePromiseFn;
  percentOpen: Animated.DerivedValue<number>;
  isGestureActive: Animated.DerivedValue<boolean>;
  direction: OpenDirection;
};

export type OverlayParams<T> = {
  item: T;
  openLeft: OpenPromiseFn;
  openRight: OpenPromiseFn;
  close: ClosePromiseFn;
  openDirection: OpenDirection;
  percentOpenLeft: Animated.DerivedValue<number>;
  percentOpenRight: Animated.DerivedValue<number>;
};
```

### Notes

Gesture handlers can sometimes capture a gesture unintentionally. If you are using with `react-native-draggable-flatlist` and the list is periodically not scrolling, try adding a small `activationDistance` (see the "Advanced" screen in the example snack).

### Example

https://snack.expo.io/@computerjazz/swipeable-item

```typescript
import React, { useCallback } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ListRenderItem,
} from "react-native";
import SwipeableItem, {
  useSwipeableItemParams,
} from "react-native-swipeable-item";

const NUM_ITEMS = 10;

function SimpleExample() {
  const renderItem: ListRenderItem<Item> = useCallback(({ item }) => {
    return (
      <SwipeableItem
        key={item.key}
        item={item}
        renderUnderlayLeft={() => <UnderlayLeft />}
        snapPointsLeft={[150]}
      >
        <View
          style={[
            styles.row,
            { backgroundColor: item.backgroundColor, height: 100 },
          ]}
        >
          <Text style={styles.text}>{`${item.text}`}</Text>
        </View>
      </SwipeableItem>
    );
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        keyExtractor={(item) => item.key}
        data={initialData}
        renderItem={renderItem}
      />
    </View>
  );
}

export default SimpleExample;

const UnderlayLeft = () => {
  const { close } = useSwipeableItemParams<Item>();
  return (
    <View style={[styles.row, styles.underlayLeft]}>
      <TouchableOpacity onPress={() => close()}>
        <Text style={styles.text}>CLOSE</Text>
      </TouchableOpacity>
    </View>
  );
};

type Item = {
  key: string;
  text: string;
  backgroundColor: string;
};

function getColor(i: number) {
  const multiplier = 255 / (NUM_ITEMS - 1);
  const colorVal = i * multiplier;
  return `rgb(${colorVal}, ${Math.abs(128 - colorVal)}, ${255 - colorVal})`;
}

const initialData: Item[] = [...Array(NUM_ITEMS)].fill(0).map((d, index) => {
  const backgroundColor = getColor(index);
  return {
    text: `${index}`,
    key: `key-${backgroundColor}`,
    backgroundColor,
  };
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
  },
  text: {
    fontWeight: "bold",
    color: "white",
    fontSize: 32,
  },
  underlayLeft: {
    flex: 1,
    backgroundColor: "tomato",
    justifyContent: "flex-end",
  },
});
```
