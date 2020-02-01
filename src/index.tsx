import React from "react";
import { StyleSheet } from "react-native";
import {
  PanGestureHandler,
  State as GestureState,
  PanGestureHandlerEventExtra,
  GestureHandlerStateChangeNativeEvent
} from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
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
  divide
} = Animated;

const tempResolve = () => {};

type RenderUnderlay<T> = (params: {
  item: T;
  percentOpen: Animated.Node<number>;
  open: () => void;
  close: () => void;
}) => React.ReactNode;

type Props<T> = {
  item: T;
  children: React.ReactNode;
  underlayWidthLeft: number;
  renderUnderlayLeft?: RenderUnderlay<T>;
  underlayWidthRight: number;
  renderUnderlayRight?: RenderUnderlay<T>;
  onChange: (params: { open: boolean | "left" | "right" }) => void;
  direction?: "left" | "right";
  overSwipe: number;
  animationConfig?: Partial<Animated.SpringConfig>;
  activationThreshold?: number;
  swipeEnabled?: boolean;
};

class SwipeableItem<T> extends React.Component<Props<T>> {
  static defaultProps = {
    onChange: () => {},
    underlayWidthLeft: 0,
    underlayWidthRight: 0,
    overSwipe: 20,
    animationConfig: {},
    activationThreshold: 20,
    swipeEnabled: true
  };

  state = {
    swipeDirection: null as "left" | "right" | null
  };

  clock = new Clock();
  prevTranslate = new Value(0);
  gestureState = new Value(GestureState.UNDETERMINED);
  animState = {
    finished: new Value(0),
    position: new Value(0),
    velocity: new Value(0),
    time: new Value(0)
  };

  // Spring animation config
  // Determines how "springy" row is when it
  // snaps back into place after released
  animConfig: Animated.SpringConfig = {
    toValue: new Value(0),
    damping: 20,
    mass: 0.2,
    stiffness: 100,
    overshootClamping: false,
    restSpeedThreshold: 0.5,
    restDisplacementThreshold: 0.5,
    ...this.props.animationConfig
  };

  panX = new Value(0);

  hasLeft = greaterThan(this.props.underlayWidthLeft, 0);
  hasRight = greaterThan(this.props.underlayWidthRight, 0);
  swipingLeft = lessThan(this.animState.position, 0);
  swipingRight = greaterThan(this.animState.position, 0);
  percentOpenLeft = cond(
    this.swipingLeft,
    divide(abs(this.animState.position), this.props.underlayWidthLeft)
  );
  percentOpenRight = cond(
    this.swipingRight,
    divide(abs(this.animState.position), this.props.underlayWidthRight)
  );
  isSwiping = or(this.swipingLeft, this.swipingRight);

  leftActive = or(
    this.swipingLeft,
    and(not(this.isSwiping), lessThan(this.panX, 0))
  );

  onSwipeLeftChange = ([isSwiping]: ReadonlyArray<number>) => {
    if (isSwiping) this.setState({ swipeDirection: "left" });
  };
  onSwipeRightChange = ([isSwiping]: ReadonlyArray<number>) => {
    if (isSwiping) this.setState({ swipeDirection: "right" });
  };
  onIsSwipingChange = ([isSwiping]: ReadonlyArray<number>) => {
    if (!isSwiping) this.setState({ swipeDirection: null });
  };

  absPosition = abs(this.animState.position);

  exceedsThresholdLeft = greaterThan(
    this.absPosition,
    divide(this.props.underlayWidthLeft, 2)
  );
  exceedsThresholdRight = greaterThan(
    this.absPosition,
    divide(this.props.underlayWidthRight, 2)
  );
  exceedsThreshold = cond(
    this.swipingLeft,
    this.exceedsThresholdLeft,
    this.exceedsThresholdRight
  );

  underlayWidth = cond(
    this.leftActive,
    this.props.underlayWidthLeft,
    this.props.underlayWidthRight
  );
  isOpen = greaterOrEq(this.absPosition, this.underlayWidth);

  isClosed = lessOrEq(sub(this.absPosition, this.underlayWidth), 0);

  underlayPosition = cond(
    this.leftActive,
    multiply(this.underlayWidth, -1),
    this.underlayWidth
  );

  openResolve: () => void = tempResolve;
  openLeftFlag = new Value<number>(0);
  openRightFlag = new Value<number>(0);
  open = (direction: "left" | "right") =>
    new Promise(resolve => {
      // Make sure any previous promises are resolved before reassignment
      if (this.openResolve) this.openResolve();
      this.openResolve = resolve;
      if (direction === "left") this.openLeftFlag.setValue(1);
      else if (direction === "right") this.openRightFlag.setValue(1);
    });

  closeResolve: () => void = tempResolve;
  closeFlag = new Value<number>(0);
  close = () =>
    new Promise(resolve => {
      // Make sure any previous promises are resolved before reassignment
      if (this.closeResolve) this.closeResolve();
      this.closeResolve = resolve;
      this.closeFlag.setValue(1);
    });

  onOpen = () => {
    if (this.openResolve) this.openResolve();
    this.props.onChange({ open: this.state.swipeDirection || false });
  };

  onClose = () => {
    if (this.closeResolve) this.closeResolve();
    this.setState({ swipeDirection: null });
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
                  this.animConfig.toValue as Animated.Value<number>,
                  cond(this.exceedsThreshold, this.underlayPosition, 0)
                ),
                startClock(this.clock)
              ]
            )
          ])
        ])
    }
  ]);

  maxTranslate = cond(
    this.leftActive,
    0,
    cond(this.hasRight, add(this.underlayPosition, this.props.overSwipe), 0)
  );
  minTranslate = cond(
    this.leftActive,
    cond(this.hasLeft, sub(this.underlayPosition, this.props.overSwipe), 0),
    0
  );

  onPanEvent = event([
    {
      nativeEvent: ({ translationX }: PanGestureHandlerEventExtra) =>
        block([
          set(this.panX, translationX),
          cond(
            and(
              eq(this.gestureState, GestureState.ACTIVE),
              lessOrEq(
                add(translationX, this.prevTranslate),
                this.maxTranslate
              ),
              greaterOrEq(
                add(translationX, this.prevTranslate),
                this.minTranslate
              )
            ),
            [
              // Update our translate animated value as the user pans
              set(
                this.animState.position,
                add(translationX, this.prevTranslate)
              )
              // If swipe distance exceeds threshold, delete item
            ]
          )
        ])
    }
  ]);

  runCode = () =>
    block([
      cond(this.openLeftFlag, [
        set(
          this.animConfig.toValue as Animated.Value<number>,
          multiply(-1, this.props.underlayWidthLeft)
        ),
        startClock(this.clock),
        set(this.openLeftFlag, 0)
      ]),
      cond(this.openRightFlag, [
        set(
          this.animConfig.toValue as Animated.Value<number>,
          this.props.underlayWidthRight
        ),
        startClock(this.clock),
        set(this.openRightFlag, 0)
      ]),
      cond(this.closeFlag, [
        set(this.animConfig.toValue as Animated.Value<number>, 0),
        startClock(this.clock),
        set(this.closeFlag, 0)
      ]),
      onChange(
        this.swipingLeft,
        call([this.swipingLeft], this.onSwipeLeftChange)
      ),
      onChange(
        this.swipingRight,
        call([this.swipingRight], this.onSwipeRightChange)
      ),
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
          set(this.animState.finished, 0)
        ])
      ])
    ]);

  render() {
    const {
      item,
      children,
      renderUnderlayLeft = () => null,
      renderUnderlayRight = () => null,
      underlayWidthLeft,
      underlayWidthRight,
      swipeEnabled,
      activationThreshold = 20
    } = this.props;
    const { swipeDirection } = this.state;
    const isSwiping = !!this.state.swipeDirection;
    const hasLeft = underlayWidthLeft > 0;
    const hasRight = underlayWidthRight > 0;
    const activeOffsetL =
      hasLeft || isSwiping ? -activationThreshold : -Number.MAX_VALUE;
    const activeOffsetR =
      hasRight || isSwiping ? activationThreshold : Number.MAX_VALUE;
    const activeOffsetX = [activeOffsetL, activeOffsetR];

    return (
      <>
        <Animated.View
          pointerEvents={swipeDirection === "left" ? "auto" : "none"}
          style={[styles.underlay, { opacity: this.leftActive }]}
        >
          {renderUnderlayLeft({
            item,
            percentOpen: this.percentOpenLeft,
            open: () => this.open("left"),
            close: this.close
          })}
        </Animated.View>
        <Animated.View
          pointerEvents={swipeDirection === "right" ? "auto" : "none"}
          style={[styles.underlay, { opacity: not(this.leftActive) }]}
        >
          {renderUnderlayRight({
            item,
            percentOpen: this.percentOpenRight,
            open: () => this.open("right"),
            close: this.close
          })}
        </Animated.View>
        <PanGestureHandler
          enabled={swipeEnabled}
          activeOffsetX={activeOffsetX}
          onGestureEvent={this.onPanEvent}
          onHandlerStateChange={this.onHandlerStateChange}
        >
          <Animated.View
            style={{
              flex: 1,
              transform: [{ translateX: this.animState.position }]
            }}
          >
            <Animated.Code>{this.runCode}</Animated.Code>
            {children}
          </Animated.View>
        </PanGestureHandler>
      </>
    );
  }
}

export default SwipeableItem;

const styles = StyleSheet.create({
  underlay: {
    ...StyleSheet.absoluteFillObject
  }
});
