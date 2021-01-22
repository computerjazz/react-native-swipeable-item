import Animated from "react-native-reanimated";
import { State as GestureState } from "react-native-gesture-handler";
let {
  cond,
  divide,
  abs,
  or,
  and,
  not,
  add,
  eq,
  set,
  lessThan,
  lessOrEq,
  greaterOrEq,
  multiply,
  proc,
  spring,
  Value
} = Animated;

if (!proc) {
  console.warn("Use reanimated > 1.3 for optimal perf");
  const procStub = (cb: any) => cb;
  proc = procStub;
}

const betterSpring = proc(
  (
    finished: Animated.Value<number>,
    velocity: Animated.Value<number>,
    position: Animated.Value<number>,
    time: Animated.Value<number>,
    prevPosition: Animated.Value<number>,
    toValue: Animated.Value<number>,
    damping: Animated.Value<number>,
    mass: Animated.Value<number>,
    stiffness: Animated.Value<number>,
    overshootClamping: Animated.SpringConfig["overshootClamping"],
    restSpeedThreshold: Animated.Value<number>,
    restDisplacementThreshold: Animated.Value<number>,
    clock: Animated.Clock
  ) =>
    spring(
      clock,
      {
        finished,
        velocity,
        position,
        time,
        // @ts-ignore -- https://github.com/software-mansion/react-native-reanimated/blob/master/src/animations/spring.js#L177
        prevPosition
      },
      {
        toValue,
        damping,
        mass,
        stiffness,
        overshootClamping,
        restDisplacementThreshold,
        restSpeedThreshold
      }
    )
);

export const getOpenPct = proc(
  (
    isSwiping: Animated.Node<number>,
    pos: Animated.Node<number>,
    width: Animated.Node<number>
  ) => cond(isSwiping, divide(abs(pos), width), 0)
);

export const getLeftActive = proc(
  (
    swipingLeft: Animated.Node<number>,
    isSwiping: Animated.Node<number>,
    panX: Animated.Node<number>
  ) => or(swipingLeft, and(not(isSwiping), lessThan(panX, 0)))
);

export const getMaxTranslate = proc(
  (
    hasRight: Animated.Node<number>,
    rightWidth: Animated.Node<number>,
    overSwipe: number
  ) => cond(hasRight, add(rightWidth, overSwipe), 0)
);

export const getMinTranslate = proc(
  (
    hasLeft: Animated.Node<number>,
    leftWidth: Animated.Node<number>,
    overSwipe: number
  ) => cond(hasLeft, multiply(-1, add(leftWidth, overSwipe)), 0)
);

export const getIsActive = proc((gestureState: Animated.Node<GestureState>) =>
  or(
    eq(gestureState, GestureState.ACTIVE),
    eq(gestureState, GestureState.BEGAN)
  )
);

export const getOnPanEvent = proc(
  (
    gestureState: Animated.Node<GestureState>,
    tempTranslate: Animated.Node<number>,
    maxTranslate: Animated.Node<number>,
    minTranslate: Animated.Node<number>,
    pos: Animated.Value<number>
  ) =>
    cond(
      and(
        eq(gestureState, GestureState.ACTIVE),
        lessOrEq(tempTranslate, maxTranslate),
        greaterOrEq(tempTranslate, minTranslate)
      ),
      set(pos, tempTranslate)
    )
);

export function springFill(
  clock: Animated.Clock,
  state: Animated.SpringState,
  config: Animated.SpringConfig
) {
  return betterSpring(
    state.finished,
    state.velocity,
    state.position,
    state.time,
    new Value(0),
    //@ts-ignore
    config.toValue,
    config.damping,
    config.mass,
    config.stiffness,
    //@ts-ignore
    config.overshootClamping,
    config.restSpeedThreshold,
    config.restDisplacementThreshold,
    clock
  );
}
