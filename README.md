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

_NOTE:_ Naming is hard. When you swipe _right_, you reveal the item on the _left_. So what do you name these things? I have decided to name everything according to swipe direction. Therefore, a swipe left reveals the `renderUnderlayLeft()` component with width `underlayWidthLeft`. Not perfect but it works.

```typescript
type RenderUnderlay<T> = (params: {
  item: T;
  percentOpen: Animated.Node<number>;
  open: (snapToIndex?: number) => Promise<void>;
  close: () => Promise<void>;
}) => React.ReactNode;

type RenderOverlay<T> = (params: {
  item: T;
  openLeft: (snapToIndex?: number) => Promise<void>;
  openRight: (snapToIndex?: number) => Promise<void>;
  close: () => Promise<void>;
}) => React.ReactNode;

enum OpenDirection {
  LEFT = "left",
  RIGHT = "right",
  NONE = 0
}
```

| Name                  | Type                                                        | Description                                                                                                                                                              |
| :-------------------- | :---------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `renderUnderlayLeft`  | `RenderUnderlay`                                            | Component to be rendered underneath row on left swipe.                                                                                                                   |
| `renderUnderlayRight` | `RenderUnderlay`                                            | Component to be rendered underneath row on right swipe.                                                                                                                   |
| `snapPointsLeft`      | `number[]`                                                  | Pixel values left-swipe snaps to (eg. `[100, 300]`)                                                                                                                      |
| `snapPointsRight`     | `number[]`                                                  | Pixel values right-swipe snaps to (eg. `[100, 300]`)                                                                                                                     |
| `renderOverlay`       | `RenderOverlay`                                             | Component to be rendered on top. Use if you need access to programmatic open/close methods. May altenatively pass children to SwipeableItem.                             |
| `onChange`            | `(params: { open: OpenDirection, snapPoint: number }) => void` | Called when row is opened or closed.                                                                                                                                     |
| `swipeEnabled`        | `boolean`                                                   | Enable/disable swipe. Defaults to `true`.                                                                                                                                |
| `activationThreshold` | `number`                                                    | Distance finger must travel before swipe engages. Defaults to 20.                                                                                                        |
| `swipeDamping`        | `number`                                                    | How much swipe velocity determines snap position. A smaller number means swipe velocity will have a larger effect and row will swipe open more easily. Defaults to `10`. |

### Instance Methods

| Name    | Type                                                                               | Description                                                      |
| :------ | :--------------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| `open`  | `(OpenDirection.LEFT \| OpenDirection.RIGHT, snapIndex?: number) => Promise<void>` | Programmatically open left or right. Promise resolves once open. |
| `close` | `() => Promise<void>`                                                              | Close all. Promise resolves once closed.                         |

```js
// Programmatic open example
const itemRef: SwipeableItem | null = null

...

<SwipeableItem ref={ref => itemRef = ref} />

...
if (itemRef) itemRef.open(OpenDirection.LEFT)
```

### Notes

Gesture handlers can sometimes capture a gesture unintentionally. If you are using with `react-native-draggable-flatlist` and the list is periodically not scrolling, try adding a small `activationDistance` (see example below).

### Example

https://snack.expo.io/@computerjazz/swipeable-draggable-list

```typescript
import React from 'react';
import {
  Text,
  View,
  StyleSheet,
  FlatList,
  LayoutAnimation,
  TouchableOpacity,
  Platform,
  UIManager,
} from 'react-native';
import Animated from 'react-native-reanimated';
import SwipeableItem, { UnderlayParams } from 'react-native-swipeable-item';
import DraggableFlatList, {
  RenderItemParams,
} from 'react-native-draggable-flatlist';
const { multiply, sub } = Animated;

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental &&
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NUM_ITEMS = 20;
function getColor(i: number) {
  const multiplier = 255 / (NUM_ITEMS - 1);
  const colorVal = i * multiplier;
  return `rgb(${colorVal}, ${Math.abs(128 - colorVal)}, ${255 - colorVal})`;
}

type Item = {
  key: string;
  text: string;
  backgroundColor: string;
  height: number;
};

const initialData: Item[] = [...Array(NUM_ITEMS)].fill(0).map((d, index) => {
  const backgroundColor = getColor(index);
  return {
    text: `Row ${index}`,
    key: `key-${backgroundColor}`,
    backgroundColor,
    height: 100,
  };
});

class App extends React.Component {
  state = {
    data: initialData,
  };

  itemRefs = new Map();

  deleteItem = (item: Item) => {
    const updatedData = this.state.data.filter((d) => d !== item);
    // Animate list to close gap when item is deleted
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    this.setState({ data: updatedData });
  };

  renderUnderlayLeft = ({ item, percentOpen }: UnderlayParams<Item>) => (
    <Animated.View
      style={[styles.row, styles.underlayLeft, { opacity: percentOpen }]} // Fade in on open
    >
      <TouchableOpacity onPressOut={() => this.deleteItem(item)}>
        <Text style={styles.text}>{`[x]`}</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  renderUnderlayRight = ({
    item,
    percentOpen,
    open,
    close,
  }: UnderlayParams<Item>) => (
    <Animated.View
      style={[
        styles.row,
        styles.underlayRight,
        {
          transform: [{ translateX: multiply(sub(1, percentOpen), -100) }], // Translate from left on open
        },
      ]}>
      <TouchableOpacity onPressOut={close}>
        <Text style={styles.text}>CLOSE</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  renderItem = ({ item, index, drag }: RenderItemParams<Item>) => {
    return (
      <SwipeableItem
        key={item.key}
        item={item}
        ref={(ref) => {
          if (ref && !this.itemRefs.get(item.key)) {
            this.itemRefs.set(item.key, ref);
          }
        }}
        onChange={({ open }) => {
          if (open) {
            // Close all other open items
            [...this.itemRefs.entries()].forEach(([key, ref]) => {
              if (key !== item.key && ref) ref.close();
            });
          }
        }}
        overSwipe={20}
        renderUnderlayLeft={this.renderUnderlayLeft}
        renderUnderlayRight={this.renderUnderlayRight}
        snapPointsLeft={[150]}
        snapPointsRight={[175]}>
        <View
          style={[
            styles.row,
            { backgroundColor: item.backgroundColor, height: item.height },
          ]}>
          <TouchableOpacity onLongPress={drag}>
            <Text style={styles.text}>{item.text}</Text>
          </TouchableOpacity>
        </View>
      </SwipeableItem>
    );
  };

  render() {
    return (
      <View style={styles.container}>
        <DraggableFlatList
          keyExtractor={(item) => item.key}
          data={this.state.data}
          renderItem={this.renderItem}
          onDragEnd={({ data }) => this.setState({ data })}
          activationDistance={20}
        />
      </View>
    );
  }
}

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
  },
  text: {
    fontWeight: 'bold',
    color: 'white',
    fontSize: 32,
  },
  underlayRight: {
    flex: 1,
    backgroundColor: 'teal',
    justifyContent: 'flex-start',
  },
  underlayLeft: {
    flex: 1,
    backgroundColor: 'tomato',
    justifyContent: 'flex-end',
  },
});

```
