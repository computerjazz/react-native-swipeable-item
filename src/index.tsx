import React from "react";
import { StyleSheet } from "react-native";
import {
  PanGestureHandler,
  State as GestureState,
  PanGestureHandlerEventExtra,
  GestureHandlerStateChangeNativeEvent
} from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import {
  springFill,
  getOpenPct,
  getLeftActive,
  getMaxTranslate,
  getMinTranslate,
  getIsActive,
  getOnPanEvent
} from "./procs";
const {
  event,
  cond,
  Value,
  block,
  set,
  eq,
  neq,
  not,
  or,
  abs,
  clockRunning,
  add,
  and,
  startClock,
  stopClock,
  greaterThan,
  lessThan,
  call,
  Clock,
  onChange,
  multiply,
  divide
} = Animated;

export enum OpenDirection {
  LEFT = "left",
  RIGHT = "right",
  NONE = 0
}

const tempResolve = () => {};
const renderNull = () => null;

type VoidPromiseFn = () => Promise<void>;

export type UnderlayParams<T> = {
  item: T;
  open: VoidPromiseFn;
  close: VoidPromiseFn;
  percentOpen: Animated.Node<number>;
  isGestureActive: Animated.Node<number>;
};

export type OverlayParams<T> = {
  item: T;
  openLeft: VoidPromiseFn;
  openRight: VoidPromiseFn;
  close: VoidPromiseFn;
  openDirection: OpenDirection;
};

export type RenderUnderlay<T> = (params: UnderlayParams<T>) => React.ReactNode;
export type RenderOverlay<T> = (params: OverlayParams<T>) => React.ReactNode;

type Props<T> = {
  item: T;
  children?: React.ReactNode;
  renderOverlay?: RenderOverlay<T>;
  renderUnderlayLeft?: RenderUnderlay<T>;
  renderUnderlayRight?: RenderUnderlay<T>;
  onChange: (params: { open: OpenDirection; snapPoint: number }) => void;
  overSwipe: number;
  animationConfig?: Partial<Animated.SpringConfig>;
  activationThreshold?: number;
  swipeEnabled?: boolean;
  snapPointsLeft?: number[];
  snapPointsRight?: number[];
  swipeDamping?: number;
};

class SwipeableItem<T> extends React.PureComponent<Props<T>> {
  static defaultProps = {
    onChange: () => {},
    overSwipe: 20,
    animationConfig: {},
    activationThreshold: 20,
    swipeEnabled: true,
    snapPointsLeft: [],
    snapPointsRight: [],
    swipeDamping: 10
  };

  state = {
    openDirection: OpenDirection.NONE,
    swipeDirection: OpenDirection.NONE
  };

  clock = new Clock();
  prevTranslate = new Value(0);
  gestureState = new Value(GestureState.UNDETERMINED);
  velocity = new Value(0);
  animState = {
    finished: new Value<number>(0),
    position: new Value<number>(0),
    velocity: new Value<number>(0),
    time: new Value<number>(0)
  };

  // Spring animation config
  // Determines how "springy" row is when it
  // snaps back into place after released
  animConfig: Animated.SpringConfig = {
    toValue: new Value<number>(0),
    damping: 20,
    mass: 0.2,
    stiffness: 100,
    overshootClamping: false,
    restSpeedThreshold: 0.5,
    restDisplacementThreshold: 0.5,
    ...this.props.animationConfig
  };

  panX = new Value(0);

  hasLeft = greaterThan(this.props.snapPointsLeft!.length, 0);
  hasRight = greaterThan(this.props.snapPointsRight!.length, 0);
  swipingLeft = lessThan(this.animState.position, 0);
  swipingRight = greaterThan(this.animState.position, 0);
  leftWidth = new Value(
    this.props.snapPointsLeft!.length
      ? this.props.snapPointsLeft![this.props.snapPointsLeft!.length - 1]
      : 0
  );
  rightWidth = new Value(
    this.props.snapPointsRight!.length
      ? this.props.snapPointsRight![this.props.snapPointsRight!.length - 1]
      : 0
  );

  percentOpenLeft = getOpenPct(
    this.swipingLeft,
    this.animState.position,
    this.leftWidth
  );
  percentOpenRight = getOpenPct(
    this.swipingRight,
    this.animState.position,
    this.rightWidth
  );

  isSwiping = or(this.swipingLeft, this.swipingRight);
  leftActive = getLeftActive(this.swipingLeft, this.isSwiping, this.panX);
  isActive = getIsActive(this.gestureState);

  onSwipeLeftChange = ([isSwiping]: readonly number[]) => {
    if (isSwiping) this.setState({ swipeDirection: OpenDirection.LEFT });
  };
  onSwipeRightChange = ([isSwiping]: readonly number[]) => {
    if (isSwiping) this.setState({ swipeDirection: OpenDirection.RIGHT });
  };
  onIsSwipingChange = ([isSwiping]: readonly number[]) => {
    if (!isSwiping) this.setState({ swipeDirection: OpenDirection.NONE });
  };

  absPosition = abs(this.animState.position);

  snapPoints = [
    ...this.props.snapPointsLeft!.map(p => p * -1),
    ...this.props.snapPointsRight!
  ]
    .reduce(
      (acc, cur) => {
        if (!acc.includes(cur)) acc.push(cur);
        return acc;
      },
      [0]
    )
    .sort()
    .map((val, i, arr) => {
      return new Value(val);
    });

  midponts = [
    ...this.props.snapPointsLeft!.map(p => p * -1),
    ...this.props.snapPointsRight!
  ]
    .reduce(
      (acc, cur) => {
        if (!acc.includes(cur)) acc.push(cur);
        return acc;
      },
      [0]
    )
    .sort()
    .map((val, i, arr) => {
      const isLast = i == arr.length - 1;
      const mid = isLast ? val : val + (arr[i + 1] - val) / 2;
      return new Value(mid);
    });

  // Approximate where item would end up with velocity taken into account
  velocityModifiedPosition = add(
    this.animState.position,
    divide(this.velocity, this.props.swipeDamping!)
  );

  // This beautiful little snippet stolen from
  // https://github.com/osdnk/react-native-reanimated-bottom-sheet/blob/master/src/index.tsx#L364-L373
  currentSnapPoint = (() => {
    const getCurrentSnapPoint = (i = 0): Animated.Node<number> =>
      i + 1 === this.snapPoints.length
        ? this.snapPoints[i]
        : cond(
            lessThan(this.velocityModifiedPosition, this.midponts[i]),
            this.snapPoints[i],
            getCurrentSnapPoint(i + 1)
          );
    // current snap point desired
    return getCurrentSnapPoint();
  })();

  openResolve: () => void = tempResolve;
  openLeftFlag = new Value<number>(0);
  openRightFlag = new Value<number>(0);
  open = (direction: OpenDirection, snapPoint?: number) =>
    new Promise<void>(resolve => {
      // Make sure any previous promises are resolved before reassignment
      if (this.openResolve) this.openResolve();
      this.openResolve = resolve;
      if (direction === OpenDirection.LEFT) {
        const { snapPointsLeft } = this.props;
        const isValid =
          typeof snapPoint === "number" && snapPoint < snapPointsLeft!.length;
        const snapTo = isValid
          ? snapPointsLeft![snapPoint!]
          : snapPointsLeft![snapPointsLeft!.length - 1];
        this.openLeftFlag.setValue(snapTo);
      } else if (direction === OpenDirection.RIGHT) {
        const { snapPointsRight } = this.props;
        const isValid =
          typeof snapPoint === "number" && snapPoint < snapPointsRight!.length;
        const snapTo = isValid
          ? snapPointsRight![snapPoint!]
          : snapPointsRight![snapPointsRight!.length - 1];
        this.openRightFlag.setValue(snapTo);
      }
    });

  closeResolve: () => void = tempResolve;
  closeFlag = new Value<number>(0);
  close = () =>
    new Promise<void>(resolve => {
      // Make sure any previous promises are resolved before reassignment
      if (this.closeResolve) this.closeResolve();
      this.closeResolve = resolve;
      this.closeFlag.setValue(1);
    });

  onOpen = (snapPoint: number) => {
    if (this.openResolve) this.openResolve();
    this.props.onChange({ open: this.state.swipeDirection, snapPoint });
  };

  onClose = () => {
    if (this.closeResolve) this.closeResolve();
    this.setState({ swipeDirection: null });
    this.props.onChange({ open: OpenDirection.NONE, snapPoint: 0 });
  };

  maxTranslate = getMaxTranslate(
    this.hasRight,
    this.rightWidth,
    this.props.overSwipe
  );
  minTranslate = getMinTranslate(
    this.hasLeft,
    this.leftWidth,
    this.props.overSwipe
  );

  onHandlerStateChange = event([
    {
      nativeEvent: ({ state }: GestureHandlerStateChangeNativeEvent) =>
        block([set(this.gestureState, state)])
    }
  ]);

  tempTranslate = new Value<number>(0);
  onPanEvent = event([
    {
      nativeEvent: ({ translationX, velocityX }: PanGestureHandlerEventExtra) =>
        cond(eq(this.gestureState, GestureState.ACTIVE), [
          set(this.panX, translationX),
          set(this.velocity, velocityX),
          set(this.tempTranslate, add(translationX, this.prevTranslate)),
          getOnPanEvent(
            this.gestureState,
            this.tempTranslate,
            this.maxTranslate,
            this.minTranslate,
            this.animState.position
          )
        ])
    }
  ]);

  onAnimationEnd = ([position, snapPointRaw]: readonly number[]) => {
    if (position === 0) {
      this.onClose();
      this.setState({ openDirection: OpenDirection.NONE });
    } else {
      this.onOpen(Math.abs(snapPointRaw));
      this.setState({
        openDirection: position < 0 ? OpenDirection.LEFT : OpenDirection.RIGHT
      });
    }
  };

  runCode = () =>
    block([
      cond(neq(this.openLeftFlag, 0), [
        set(
          this.animConfig.toValue as Animated.Value<number>,
          multiply(-1, this.openLeftFlag)
        ),
        startClock(this.clock),
        set(this.openLeftFlag, 0)
      ]),
      cond(neq(this.openRightFlag, 0), [
        set(
          this.animConfig.toValue as Animated.Value<number>,
          this.openRightFlag
        ),
        startClock(this.clock),
        set(this.openRightFlag, 0)
      ]),
      cond(neq(this.closeFlag, 0), [
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
      // Spring row back into place when user lifts their finger before reaching threshold
      onChange(this.isActive, [
        cond(and(not(this.isActive), not(clockRunning(this.clock))), [
          set(
            this.animConfig.toValue as Animated.Value<number>,
            this.currentSnapPoint
          ),
          set(this.velocity, 0),
          startClock(this.clock)
        ])
      ]),
      onChange(
        this.gestureState,
        cond(eq(this.gestureState, GestureState.BEGAN), [
          cond(clockRunning(this.clock), stopClock(this.clock)),
          set(this.prevTranslate, this.animState.position)
        ])
      ),
      onChange(this.isSwiping, call([this.isSwiping], this.onIsSwipingChange)),
      // If the clock is running, increment position in next tick by calling spring()
      cond(clockRunning(this.clock), [
        springFill(this.clock, this.animState, this.animConfig),
        // Stop and reset clock when spring is complete
        cond(this.animState.finished, [
          stopClock(this.clock),
          call(
            [this.animState.position, this.currentSnapPoint],
            this.onAnimationEnd
          ),
          set(this.animState.finished, 0)
        ])
      ])
    ]);

  openLeft = (snapPoint?: number) => this.open(OpenDirection.LEFT, snapPoint);
  openRight = (snapPoint?: number) => this.open(OpenDirection.RIGHT, snapPoint);

  render() {
    const {
      item,
      children,
      renderOverlay = renderNull,
      renderUnderlayLeft = renderNull,
      renderUnderlayRight = renderNull,
      snapPointsLeft,
      snapPointsRight,
      swipeEnabled,
      activationThreshold = 20
    } = this.props;
    const { swipeDirection, openDirection } = this.state;
    const hasLeft = !!snapPointsLeft!.length;
    const hasRight = !!snapPointsRight!.length;
    const activeOffsetL =
      hasLeft || openDirection === OpenDirection.RIGHT
        ? -activationThreshold
        : -Number.MAX_VALUE;
    const activeOffsetR =
      hasRight || openDirection === OpenDirection.LEFT
        ? activationThreshold
        : Number.MAX_VALUE;
    const activeOffsetX = [activeOffsetL, activeOffsetR];
    return (
      <>
        <Animated.View
          pointerEvents={
            swipeDirection === OpenDirection.LEFT ? "auto" : "none"
          }
          style={[styles.underlay, { opacity: this.leftActive }]}
        >
          {renderUnderlayLeft({
            item,
            percentOpen: this.percentOpenLeft,
            open: this.openLeft,
            close: this.close,
            isGestureActive: this.isActive
          })}
        </Animated.View>
        <Animated.View
          pointerEvents={
            swipeDirection === OpenDirection.RIGHT ? "auto" : "none"
          }
          style={[styles.underlay, { opacity: not(this.leftActive) }]}
        >
          {renderUnderlayRight({
            item,
            percentOpen: this.percentOpenRight,
            open: this.openRight,
            close: this.close,
            isGestureActive: this.isActive
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
            <Animated.Code dependencies={[]}>{this.runCode}</Animated.Code>
            {children}
            {renderOverlay({
              item,
              openLeft: this.openLeft,
              openRight: this.openRight,
              close: this.close,
              openDirection
            })}
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
