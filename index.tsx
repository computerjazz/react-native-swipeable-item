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
  abs,
  sub,
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
  divide,
} = Animated;

type Props = {
  children: React.ReactNode;
  underlayWidth: number;
  renderUnderlay: () => React.ReactNode;
  onChange: (isOpen: boolean) => void;
  direction?: 'left' | 'right';
};

class SwipeRow extends React.Component<Props> {
  static defaultProps = {
    onChange: () => { },
    underlayWidth: 200,
    direction: 'left',
  };

  isLeft = new Value(this.props.direction === 'left' ? 1 : 0);

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

  absPosition = abs(this.animState.position)
  exceedsThreshold = greaterThan(this.absPosition, divide(this.props.underlayWidth, 2))

  isOpen = greaterOrEq(this.absPosition, this.props.underlayWidth)

  isClosed = lessOrEq(
    sub(this.absPosition, this.props.underlayWidth),
    0
  );

  underlayPosition = cond(
    this.isLeft,
    multiply(this.props.underlayWidth, -1),
    this.props.underlayWidth
  );

  openFlag = new Value<number>(0);
  open = () => this.openFlag.setValue(1);

  closeFlag = new Value<number>(0);
  close = () => this.closeFlag.setValue(1);

  onOpen = () => {
    this.props.onChange(true);
  };

  onClose = () => {
    this.props.onChange(false);
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

  maxTranslate = cond(this.isLeft, 0, this.underlayPosition)
  minTranslate = cond(this.isLeft, this.underlayPosition, 0)

  onPanEvent = event([
    {
      nativeEvent: ({ translationX }: PanGestureHandlerEventExtra) =>
        block([
          cond(
            and(
              eq(this.gestureState, GestureState.ACTIVE),
              lessOrEq(add(translationX, this.prevTranslate), this.maxTranslate),
              greaterOrEq(add(translationX, this.prevTranslate), this.minTranslate),
            ), [
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
