import React from 'react';
import { StyleSheet } from 'react-native';
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
  or,
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

type Props<T> = {
  item: T,
  children: React.ReactNode;
  underlayWidthLeft: number;
  renderUnderlayLeft?: (item: T) => React.ReactNode;
  underlayWidthRight: number;
  renderUnderlayRight?: (item: T) => React.ReactNode;
  onChange: (params: { open: boolean | 'left' | 'right' }) => void;
  overSwipe: number
};

class SwipeRow<T> extends React.Component<Props<T>> {
  static defaultProps = {
    onChange: () => { },
    underlayWidthLeft: 0,
    underlayWidthRight: 0,
    overSwipe: 20,
  };

  state = {
    swipeDirection: null as "left" | "right" | null,
  }

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

  panX = new Value(0)

  swipingLeft = lessThan(this.animState.position, 0)
  swipingRight = greaterThan(this.animState.position, 0)
  isSwiping = or(this.swipingLeft, this.swipingRight)

  leftActive = or(this.swipingLeft, and(not(this.isSwiping), lessThan(this.panX, 0)))


  onSwipeLeftChange = ([isSwiping]: ReadonlyArray<number>) => {
    if (isSwiping) this.setState({ swipeDirection: "left" })
  }
  onSwipeRightChange = ([isSwiping]: ReadonlyArray<number>) => {
    if (isSwiping) this.setState({ swipeDirection: "right" })
  }
  onIsSwipingChange = ([isSwiping]: ReadonlyArray<number>) => {
    if (!isSwiping) this.setState({ swipeDirection: null })
  }

  absPosition = abs(this.animState.position)

  exceedsThresholdLeft = greaterThan(this.absPosition, divide(this.props.underlayWidthLeft, 2))
  exceedsThresholdRight = greaterThan(this.absPosition, divide(this.props.underlayWidthRight, 2))
  exceedsThreshold = cond(this.swipingLeft, this.exceedsThresholdLeft, this.exceedsThresholdRight)

  underlayWidth = cond(this.leftActive, this.props.underlayWidthLeft, this.props.underlayWidthRight)
  isOpen = greaterOrEq(this.absPosition, this.underlayWidth)

  isClosed = lessOrEq(
    sub(this.absPosition, this.underlayWidth),
    0
  );

  underlayPosition = cond(
    this.leftActive,
    multiply(this.underlayWidth, -1),
    this.underlayWidth
  );

  openLeftFlag = new Value<number>(0);
  openRightFlag = new Value<number>(0);
  open = (direction: "left" | "right") => {
    if (direction === "left") this.openLeftFlag.setValue(1);
    else if (direction === "right") this.openRightFlag.setValue(1);
  }

  closeFlag = new Value<number>(0);
  close = () => this.closeFlag.setValue(1);

  onOpen = () => {
    this.props.onChange({ open: this.state.swipeDirection || false });
  };

  onClose = () => {
    this.props.onChange({ open: false });
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


  maxTranslate = cond(this.leftActive, 0, add(this.underlayPosition, this.props.overSwipe))
  minTranslate = cond(this.leftActive, sub(this.underlayPosition, this.props.overSwipe), 0)

  onPanEvent = event([
    {
      nativeEvent: ({ translationX }: PanGestureHandlerEventExtra) =>
        block([
          set(this.panX, translationX),
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

  runCode = () =>
    block([
      cond(this.openLeftFlag, [
        set(this.animConfig.toValue, multiply(-1, this.props.underlayWidthLeft)),
        startClock(this.clock),
        set(this.openLeftFlag, 0),
      ]),
      cond(this.openRightFlag, [
        set(this.animConfig.toValue, this.props.underlayWidthRight),
        startClock(this.clock),
        set(this.openRightFlag, 0),
      ]),
      cond(this.closeFlag, [
        set(this.animConfig.toValue, 0),
        startClock(this.clock),
        set(this.closeFlag, 0),
      ]),
      onChange(this.swipingLeft, call([this.swipingLeft], this.onSwipeLeftChange)),
      onChange(this.swipingRight, call([this.swipingRight], this.onSwipeRightChange)),
      onChange(this.isSwiping, call([this.isSwiping], this.onIsSwipingChange)),

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
    const {
      item,
      children,
      renderUnderlayLeft = () => null,
      renderUnderlayRight = () => null,
    } = this.props;
    return (
      <PanGestureHandler
        minDeltaX={10}
        onGestureEvent={this.onPanEvent}
        onHandlerStateChange={this.onHandlerStateChange}>
        <Animated.View>
          <Animated.Code>{this.runCode}</Animated.Code>
          <Animated.View
            pointerEvents={this.state.swipeDirection === "left" ? "auto" : "none"}
            style={[styles.underlay, { opacity: this.leftActive }]}
          >{renderUnderlayLeft(item)}</Animated.View>
          <Animated.View
            pointerEvents={this.state.swipeDirection === "right" ? "auto" : "none"}
            style={[styles.underlay, { opacity: not(this.leftActive) }]}
          >{renderUnderlayRight(item)}</Animated.View>
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
