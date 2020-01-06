# React Native Swipeable Item

A swipeable component with underlay for React Native.<br />
Fully native interactions powered by [Reanimated](https://github.com/kmagiera/react-native-reanimated) and [React Native Gesture Handler](https://github.com/kmagiera/react-native-gesture-handler)

Compatible with [React Native Draggable Flatlist](https://github.com/computerjazz/react-native-draggable-flatlist)

![Swipeable Item demo](https://i.imgur.com/zc2IrRl.gif)

## Install
1. Follow installation instructions for [reanimated](https://github.com/kmagiera/react-native-reanimated) and [react-native-gesture-handler](https://github.com/kmagiera/react-native-gesture-handler)
2. `npm install` or `yarn add` `react-native-swipeable-item` 
3. `import SwipeItem from 'react-native-swipeable-Item'`  

### Props
Name | Type | Description
:--- | :--- | :---
`direction` | `"left" \| "right"` | Direction that the item slides.
`renderUnderlay` | `() => React.ReactNode` |  Component to be rendered underneath row.
`underlayWidth` | `number` | Width of underlay.
`onChange` | `(isOpen: boolean) => void` |  Called when row is opened or closed.


### Example
```javascript
import * as React from 'react';
import {
  Text,
  View,
  StyleSheet,
  FlatList,
  LayoutAnimation,
  TouchableOpacity,
} from 'react-native';
import SwipeItem from 'react-native-swipeable-item';

const NUM_ITEMS = 10;
function getColor(i) {
  const multiplier = 255 / (NUM_ITEMS - 1);
  const colorVal = i * multiplier;
  return `rgb(${colorVal}, ${Math.abs(128 - colorVal)}, ${255 - colorVal})`;
}

const initialData = [...Array(NUM_ITEMS)].fill(0).map((d, index) => ({
  text: `Row ${index}`,
  key: `key-${index}`, // Note: It's bad practice to use index as your key. Don't do it in production!
  backgroundColor: getColor(index),
}));

class App extends React.Component {
  state = {
    data: initialData,
  };

  deleteItem = item => {
    const updatedData = this.state.data.filter(d => d !== item);
    // Animate list to close gap when item is deleted
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    this.setState({ data: updatedData });
  };

  renderItem = ({ item, index }) => (
    <SwipeItem
      key={item.key}
      direction="left"
      underlayWidth={200}
      renderUnderlay={() => (
          <View style={styles.underlay}>
            <TouchableOpacity onPress={() => this.deleteItem(item)}>
              <Text style={styles.text}>{`[x]`}</Text>
            </TouchableOpacity>
          </View>
        )
      }>
      <View
        style={{ 
          flexDirection: 'row', 
          backgroundColor: item.backgroundColor 
        }}
       >
        <Text style={styles.text}>{item.text}</Text>
      </View>
    </SwipeItem>
  );

  render() {
    return (
      <View style={styles.container}>
        <FlatList 
          data={this.state.data} 
          renderItem={this.renderItem} 
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
  text: {
    fontWeight: 'bold',
    color: 'white',
    fontSize: 32,
    flex: 1,
    textAlign: 'center',
    padding: 25,
  },
  underlay: { 
    flex: 1, 
    backgroundColor: 'tomato', 
    alignItems: 'flex-end' 
  }
});
```
