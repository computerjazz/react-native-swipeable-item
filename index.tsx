import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  PanGestureHandler,
  State as GestureState,
  PanGestureHandlerEventExtra,
  GestureHandlerStateChangeNativeEvent,
} from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
const {
  event,
  cond,
  Value,
  block,
  set,
  eq,
  not,
  clockRunning,
  add,
  and,
  startClock,
  stopClock,
  spring,
  greaterThan,
  greaterOrEq,
  lessThan,
  lessOrEq,
  call,
  Clock,
  onChange,
  multiply,
} = Animated;

type Props = {
  children: React.ReactNode;
  swipeThreshold: number;
  underlayWidth: number;
  renderUnderlay: () => React.ReactNode;
  onOpen: () => void;
  onClose: () => void;
};

class SwipeRow extends React.Component<Props> {
  static defaultProps = {
    onOpen: () => { },
    onClose: () => { },
    swipeThreshold: 100,
    underlayWidth: 200,
  };

  clock = new Clock();
  prevTranslate = new Value(0);
  gestureState = new Value(GestureState.UNDETERMINED);
  animState = {
    finished: new Value(0),
    position: new Value(0),
    velocity: new Value(0),
    time: new Value(0),
  };

  // Spring animation config
  // Determines how "springy" row is when it
  // snaps back into place after released
  animConfig = {
    toValue: new Value(0),
    damping: 20,
    mass: 0.2,
    stiffness: 100,
    overshootClamping: false,
    restSpeedThreshold: 0.2,
    restDisplacementThreshold: 0.2,
  };

  exceedsThreshold = cond(
    greaterThan(this.props.swipeThreshold, 0),
    greaterThan(this.animState.position, this.props.swipeThreshold),
    lessThan(this.animState.position, this.props.swipeThreshold)
  );

  isOpen = cond(
    greaterThan(this.props.swipeThreshold, 0),
    greaterOrEq(this.animState.position, this.props.underlayWidth),
    lessOrEq(this.animState.position, this.props.underlayWidth)
  );

  isClosed = eq(this.animState.position, 0);

  underlayPosition = cond(
    greaterThan(this.props.swipeThreshold, 0),
    this.props.underlayWidth,
    multiply(this.props.underlayWidth, -1)
  );

  openFlag = new Value<number>(0);
  open = () => this.openFlag.setValue(1);

  closeFlag = new Value<number>(0);
  close = () => this.closeFlag.setValue(1);

  onOpen = () => {
    this.props.onOpen();
  };

  onClose = () => {
    this.props.onClose();
  };

  // Called whenever gesture state changes. (User begins/ends pan,
  // or if the gesture is cancelled/fails for some reason)
  onHandlerStateChange = event([
    {
      nativeEvent: ({ state }: GestureHandlerStateChangeNativeEvent) =>
        block([
          // Update our animated value that tracks gesture state
          set(this.gestureState, state),
          // Spring row back into place when user lifts their finger before reaching threshold
          onChange(this.gestureState, [
            set(this.prevTranslate, this.animState.position),
            cond(
              and(eq(state, GestureState.END), not(clockRunning(this.clock))),
              [
                set(
                  this.animConfig.toValue,
                  cond(this.exceedsThreshold, this.underlayPosition, 0)
                ),
                startClock(this.clock),
              ]
            ),
          ]),
        ]),
    },
  ]);

  onPanEvent = event([
    {
      nativeEvent: ({ translationX }: PanGestureHandlerEventExtra) =>
        block([
          cond(eq(this.gestureState, GestureState.ACTIVE), [
            // Update our translate animated value as the user pans
            set(this.animState.position, add(translationX, this.prevTranslate)),
            // If swipe distance exceeds threshold, delete item
          ]),
        ]),
    },
  ]);

  translate = add(this.animState.position, this.prevTranslate);
  runCode = () =>
    block([
      cond(this.openFlag, [
        set(this.animConfig.toValue, this.underlayPosition),
        startClock(this.clock),
        set(this.openFlag, 0),
      ]),
      cond(this.closeFlag, [
        set(this.animConfig.toValue, 0),
        startClock(this.clock),
        set(this.closeFlag, 0),
      ]),

      // If the clock is running, increment position in next tick by calling spring()
      cond(clockRunning(this.clock), [
        spring(this.clock, this.animState, this.animConfig),
        // Stop and reset clock when spring is complete
        cond(this.animState.finished, [
          stopClock(this.clock),
          cond(
            eq(this.animState.position, 0),
            call([this.animState.position], this.onClose),
            call([this.animState.position], this.onOpen)
          ),
          set(this.animState.finished, 0),
        ]),
      ]),
    ]);

  render() {
    const { children, renderUnderlay = () => null } = this.props;
    return (
      <PanGestureHandler
        minDeltaX={10}
        onGestureEvent={this.onPanEvent}
        onHandlerStateChange={this.onHandlerStateChange}>
        <Animated.View>
          <Animated.Code>{this.runCode}</Animated.Code>
          <View style={styles.underlay}>{renderUnderlay()}</View>
          <Animated.View
            style={{
              flex: 1,
              transform: [{ translateX: this.animState.position }],
            }}>
            {children}
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>
    );
  }
}

export default SwipeRow;

const styles = StyleSheet.create({
  underlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
