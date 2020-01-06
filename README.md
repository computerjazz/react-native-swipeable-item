# React Native Swipeable Item

A swipeable component with underlay for React Native.<br />
Fully native interactions powered by [Reanimated](https://github.com/kmagiera/react-native-reanimated) and [React Native Gesture Handler](https://github.com/kmagiera/react-native-gesture-handler)

![Swipeable Item demo](https://imgur.com/W2qACyE.gif)

## Install
1. Follow installation instructions for [reanimated](https://github.com/kmagiera/react-native-reanimated) and [react-native-gesture-handler](https://github.com/kmagiera/react-native-gesture-handler)
2. `npm install` or `yarn add` `react-native-swipeable-item` 
3. `import SwipeItem from 'react-native-swipeable-Item'`  

### Props
Name | Type | Description
:--- | :--- | :---
`renderUnderlay` | `() => React.ReactNode` |  Component to be rendered underneath row.
`underlayWidth` | `number` | Width of underlay.
`swipeThreshold` | `number` | Swipe threshold for underlay to remain open on release.
`onOpen` | `() => void` |  Called when row is opened.
`onClose` | `() => void` | Called when row is closed.


### Example
```javascript
import * as React from 'react';
const { useCallback, useState } = React;
import {
  Text,
  View,
  StyleSheet,
  FlatList,
  LayoutAnimation,
  TouchableOpacity,
} from 'react-native';
import SwipeRow from './components/SwipeRow';

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

  refMap = new Map();
  openMap = new Map();

  deleteItem = item => {
    const updatedData = this.state.data.filter(d => d !== item);
    // Animate list to close gap when item is deleted
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    this.setState({ data: updatedData });
  };

  renderItem = ({ item, index }) => (
    <SwipeRow
      ref={ref => this.refMap.set(item.key, ref)}
      key={item.key}
      underlayWidth={200}
      swipeThreshold={-150}
      onOpen={() => this.openMap.set(item.key, true)}
      onClose={() => this.openMap.set(item.key, false)}
      renderUnderlay={() => {
        return (
          <View style={styles.underlay}>
            <TouchableOpacity onPress={() => this.deleteItem(item)}>
              <Text style={styles.text}>DEL</Text>
            </TouchableOpacity>
          </View>
        );
      }}>
      <View
        style={{ flexDirection: 'row', backgroundColor: item.backgroundColor }}>
        <Text style={styles.text}>{item.text}</Text>
        <TouchableOpacity
          onPress={() => {
            const ref = this.refMap.get(item.key);
            if (ref) {
              if (this.openMap.get(item.key)) ref.close();
              else ref.open();
            }
          }}>
          <Text style={styles.text}>{`<>`}</Text>
        </TouchableOpacity>
      </View>
    </SwipeRow>
  );

  render() {
    return (
      <View style={styles.container}>
        <FlatList data={this.state.data} renderItem={this.renderItem} />
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
