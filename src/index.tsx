import React, {
  ForwardedRef,
  useCallback,
  useContext,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Platform, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolate,
  WithSpringConfig,
  useAnimatedProps,
} from "react-native-reanimated";

const isWeb = Platform.OS === "web";

export enum OpenDirection {
  LEFT = "left",
  RIGHT = "right",
  NONE = "none",
}

const renderNull = () => null;

const MAX_Z_INDEX = 100;

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

const UnderlayContext = React.createContext<
  UnderlayParams<unknown> | undefined
>(undefined);
const OverlayContext = React.createContext<OverlayParams<unknown> | undefined>(
  undefined
);

export type RenderUnderlay<T> = (params: UnderlayParams<T>) => React.ReactNode;
export type RenderOverlay<T> = (params: OverlayParams<T>) => React.ReactNode;

type Props<T> = {
  item: T;
  children?: React.ReactNode;
  renderOverlay?: RenderOverlay<T>;
  renderUnderlayLeft?: RenderUnderlay<T>;
  renderUnderlayRight?: RenderUnderlay<T>;
  onChange?: (params: {
    openDirection: OpenDirection;
    snapPoint: number;
  }) => void;
  overSwipe?: number;
  animationConfig?: Partial<WithSpringConfig>;
  activationThreshold?: number;
  swipeEnabled?: boolean;
  snapPointsLeft?: number[];
  snapPointsRight?: number[];
  swipeDamping?: number;
};

export type SwipeableItemImperativeRef = {
  open: (
    openDirection: OpenDirection,
    snapPoint?: number,
    options?: OpenCloseOptions
  ) => Promise<void>;
  close: ClosePromiseFn;
};

function SwipeableItem<T>(
  props: Props<T>,
  ref: ForwardedRef<SwipeableItemImperativeRef>
) {
  const {
    item,
    children,
    renderOverlay = renderNull,
    renderUnderlayLeft = renderNull,
    renderUnderlayRight = renderNull,
    snapPointsLeft = [],
    snapPointsRight = [],
    swipeEnabled,
    activationThreshold = 20,
    overSwipe = 20,
    swipeDamping = 10,
    onChange = () => {},
    animationConfig = {},
  } = props;

  const springConfig: WithSpringConfig = {
    damping: 20,
    mass: 0.2,
    stiffness: 100,
    overshootClamping: false,
    restSpeedThreshold: 0.5,
    restDisplacementThreshold: 0.5,
    ...animationConfig,
  };

  const [openDirection, setOpenDirection] = useState(OpenDirection.NONE);

  const animStatePos = useSharedValue(0);
  const isGestureActive = useSharedValue(false);

  const swipingLeft = useDerivedValue(
    () => animStatePos.value < 0,
    [animStatePos]
  );
  const swipingRight = useDerivedValue(
    () => animStatePos.value > 0,
    [animStatePos]
  );

  const maxSnapPointLeft =
    -1 * Math.max(...(snapPointsLeft.length ? snapPointsLeft : [0]));
  const maxSnapPointRight = Math.max(
    ...(snapPointsRight.length ? snapPointsRight : [0])
  );

  // Only include overswipe if the max snap point is greater than zero
  const maxTranslateLeft =
    maxSnapPointLeft - (maxSnapPointLeft ? overSwipe : 0);
  const maxTranslateRight =
    maxSnapPointRight + (maxSnapPointRight ? overSwipe : 0);

  const percentOpenLeft = useDerivedValue(() => {
    return swipingLeft.value && maxSnapPointLeft
      ? Math.abs(animStatePos.value / maxSnapPointLeft)
      : 0;
  }, [maxSnapPointLeft]);
  const percentOpenRight = useDerivedValue(() => {
    return swipingRight.value && maxSnapPointRight
      ? Math.abs(animStatePos.value / maxSnapPointRight)
      : 0;
  }, [maxSnapPointRight]);

  const hasLeft = !!snapPointsLeft?.length;
  const hasRight = !!snapPointsRight?.length;

  const activeOffsetL =
    hasLeft || openDirection === OpenDirection.RIGHT
      ? -activationThreshold
      : -Number.MAX_VALUE;
  const activeOffsetR =
    hasRight || openDirection === OpenDirection.LEFT
      ? activationThreshold
      : Number.MAX_VALUE;
  const activeOffsetX = [activeOffsetL, activeOffsetR];

  const leftStyle = useAnimatedStyle(() => {
    const opacity = percentOpenLeft.value > 0 ? 1 : 0;
    const zIndex = Math.floor(
      Math.min(percentOpenLeft.value * MAX_Z_INDEX, MAX_Z_INDEX - 1)
    );

    return isWeb ? { opacity, zIndex } : { opacity };
  }, []);
  const rightStyle = useAnimatedStyle(() => {
    const opacity = percentOpenRight.value > 0 ? 1 : 0;
    const zIndex = Math.floor(
      Math.min(percentOpenRight.value * MAX_Z_INDEX, MAX_Z_INDEX - 1)
    );

    return isWeb ? { opacity, zIndex } : { opacity };
  }, []);
  const overlayStyle = useAnimatedStyle(() => {
    const transform = [{ translateX: animStatePos.value }];
    const zIndex = MAX_Z_INDEX;

    return isWeb ? { transform, zIndex } : { transform };
  }, [animStatePos]);

  const openLeft: OpenPromiseFn = (snapPoint, options) => {
    const toValue = snapPoint ?? maxSnapPointLeft;

    return new Promise<void>((resolve) => {
      function resolvePromiseIfFinished(isFinished: boolean) {
        if (isFinished) resolve();
        onAnimationEnd(OpenDirection.LEFT, toValue);
      }

      if (options?.animated === false) {
        animStatePos.value = toValue;
        runOnJS(resolvePromiseIfFinished)(true);
      } else {
        animStatePos.value = withSpring(toValue, springConfig, (isFinished) => {
          if (isFinished) {
            runOnJS(resolvePromiseIfFinished)(isFinished);
          }
        });
      }
    });
  };

  const openRight: OpenPromiseFn = (snapPoint, options) => {
    const toValue = snapPoint ?? maxSnapPointRight;

    return new Promise<void>((resolve) => {
      function resolvePromiseIfFinished(isFinished: boolean) {
        if (isFinished) resolve();
        onAnimationEnd(OpenDirection.RIGHT, toValue);
      }

      if (options?.animated === false) {
        animStatePos.value = toValue;
        runOnJS(resolvePromiseIfFinished)(true);
      } else {
        animStatePos.value = withSpring(toValue, springConfig, (isFinished) => {
          if (isFinished) {
            runOnJS(resolvePromiseIfFinished)(isFinished);
          }
        });
      }
    });
  };

  const close: ClosePromiseFn = (options) => {
    const toValue = 0;
    return new Promise<void>((resolve) => {
      function resolvePromiseIfFinished(isFinished: boolean) {
        if (isFinished) resolve();
        onAnimationEnd(OpenDirection.NONE, toValue);
      }

      if (options?.animated === false) {
        animStatePos.value = toValue;
        runOnJS(resolvePromiseIfFinished)(true);
      } else {
        animStatePos.value = withSpring(toValue, springConfig, (isFinished) => {
          if (isFinished) {
            runOnJS(resolvePromiseIfFinished)(isFinished);
          }
        });
      }
    });
  };

  useImperativeHandle(ref, () => {
    const refObject: SwipeableItemImperativeRef = {
      open: (openDirection, snapPoint, options) => {
        if (openDirection === OpenDirection.LEFT)
          return openLeft(snapPoint, options);
        if (openDirection === OpenDirection.RIGHT)
          return openRight(snapPoint, options);
        return close();
      },
      close,
    };
    return refObject;
  });

  function onAnimationEnd(_openDirection: OpenDirection, snapPoint: number) {
    setOpenDirection(_openDirection);
    const didChange =
      openDirection !== OpenDirection.NONE ||
      _openDirection !== OpenDirection.NONE;
    if (didChange) {
      onChange({ openDirection: _openDirection, snapPoint });
    }
  }

  const startX = useSharedValue(0);

  const gesture = Gesture.Pan()
    .onBegin(() => {
      if (isWeb) {
        // onStart not called on web
        // remove when fixed: https://github.com/software-mansion/react-native-gesture-handler/issues/2057
        startX.value = animStatePos.value;
        isGestureActive.value = true;
      }
    })
    .onStart(() => {
      startX.value = animStatePos.value;
      isGestureActive.value = true;
    })
    .onUpdate((evt) => {
      const rawVal = evt.translationX + startX.value;
      const clampedVal = interpolate(
        rawVal,
        [maxTranslateLeft, maxTranslateRight],
        [maxTranslateLeft, maxTranslateRight],
        Extrapolate.CLAMP
      );
      animStatePos.value = clampedVal;
    })
    .onEnd((evt) => {
      isGestureActive.value = false;

      // Approximate where item would end up with velocity taken into account
      const velocityModifiedPosition =
        animStatePos.value + evt.velocityX / swipeDamping;

      const allSnapPoints = snapPointsLeft
        .map((p) => p * -1)
        .concat(snapPointsRight);

      // The user is not required to designate [0] in their snap point array,
      // but we need to make sure 0 is a snap point.

      allSnapPoints.push(0);

      const closestSnapPoint = allSnapPoints.reduce((acc, cur) => {
        const diff = Math.abs(velocityModifiedPosition - cur);
        const prevDiff = Math.abs(velocityModifiedPosition - acc);
        return diff < prevDiff ? cur : acc;
      }, Infinity);

      const onComplete = () => {
        "worklet";
        const openDirection =
          closestSnapPoint === 0
            ? OpenDirection.NONE
            : closestSnapPoint > 0
            ? OpenDirection.RIGHT
            : OpenDirection.LEFT;
        runOnJS(onAnimationEnd)(openDirection, Math.abs(closestSnapPoint));
      };
      if (animStatePos.value === closestSnapPoint) onComplete();
      else
        animStatePos.value = withSpring(
          closestSnapPoint,
          springConfig,
          onComplete
        );
    })
    .enabled(swipeEnabled !== false)
    .activeOffsetX(activeOffsetX);

  const sharedParams = useMemo(
    () => ({
      item,
      isGestureActive,
      close,
    }),
    []
  );

  const underlayRightParams = useMemo(() => {
    return {
      open: openRight,
      percentOpen: percentOpenRight,
      direction: OpenDirection.RIGHT,
      ...sharedParams,
    };
  }, [percentOpenRight, openRight, sharedParams]);

  const underlayLeftParams = useMemo(() => {
    return {
      open: openLeft,
      percentOpen: percentOpenLeft,
      direction: OpenDirection.LEFT,
      ...sharedParams,
    };
  }, [item, percentOpenLeft, openLeft, sharedParams]);

  const overlayParams = useMemo(() => {
    // If there is only one swipe direction, use it as the 'open' function. Otherwise we need to choose one.
    const open =
      hasLeft && !hasRight
        ? openLeft
        : hasRight && !hasLeft
        ? openRight
        : openLeft;

    return {
      openLeft: openLeft,
      openRight: openRight,
      percentOpenLeft,
      percentOpenRight,
      openDirection,
      open,
      ...sharedParams,
    };
  }, [
    openLeft,
    openRight,
    openDirection,
    percentOpenLeft,
    percentOpenRight,
    hasLeft,
    hasRight,
  ]);

  const animPropsLeft = useAnimatedProps(() => {
    // useAnimatedProps broken on web: https://github.com/software-mansion/react-native-reanimated/issues/1808
    if (isWeb) return { pointerEvents: "auto" as const };
    return {
      pointerEvents:
        percentOpenLeft.value > 0 ? ("auto" as const) : ("none" as const),
    };
  }, []);

  const animPropsRight = useAnimatedProps(() => {
    // useAnimatedProps broken on web: https://github.com/software-mansion/react-native-reanimated/issues/1808
    if (isWeb) return { pointerEvents: "auto" as const };
    return {
      pointerEvents:
        percentOpenRight.value > 0 ? ("auto" as const) : ("none" as const),
    };
  }, []);

  return (
    <OverlayContext.Provider value={overlayParams}>
      <Animated.View
        animatedProps={animPropsLeft}
        style={[styles.underlay, leftStyle]}
      >
        <UnderlayContext.Provider value={underlayLeftParams}>
          {renderUnderlayLeft(underlayLeftParams)}
        </UnderlayContext.Provider>
      </Animated.View>
      <Animated.View
        animatedProps={animPropsRight}
        style={[styles.underlay, rightStyle]}
      >
        <UnderlayContext.Provider value={underlayRightParams}>
          {renderUnderlayRight(underlayRightParams)}
        </UnderlayContext.Provider>
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.flex, overlayStyle]}>
          {children}
          {renderOverlay(overlayParams)}
        </Animated.View>
      </GestureDetector>
    </OverlayContext.Provider>
  );
}

export default React.forwardRef(SwipeableItem) as <T>(
  props: Props<T> & { ref?: React.ForwardedRef<SwipeableItemImperativeRef> }
) => React.ReactElement;

export function useUnderlayParams<T>() {
  const underlayContext = useContext(UnderlayContext);
  if (!underlayContext) {
    throw new Error(
      "useUnderlayParams must be called from within an UnderlayContext.Provider!"
    );
  }
  return underlayContext as UnderlayParams<T>;
}

export function useOverlayParams<T>() {
  const overlayContext = useContext(OverlayContext);
  if (!overlayContext) {
    throw new Error(
      "useOverlayParams must be called from within an OverlayContext.Provider!"
    );
  }
  return overlayContext as OverlayParams<T>;
}

export function useSwipeableItemParams<T>() {
  const overlayContext = useContext(OverlayContext) as
    | OverlayParams<T>
    | undefined;
  if (!overlayContext) {
    throw new Error(
      "useSwipeableItemParams must be called from within an OverlayContext.Provider!"
    );
  }
  const underlayContext = useContext(UnderlayContext);
  const contextDirection = underlayContext?.direction;

  const open = useCallback(
    (snapPoint?: number, direction?: OpenDirection) => {
      const openFnLeft = overlayContext.openLeft;
      const openFnRight = overlayContext.openRight;
      const openDirection = direction || contextDirection;
      const openFn =
        openDirection === OpenDirection.LEFT ? openFnLeft : openFnRight;
      return openFn(snapPoint);
    },
    [overlayContext, contextDirection]
  );

  const percentOpen = useMemo(() => {
    if (contextDirection) {
      // If we're calling from within an underlay context, return the open percentage of that underlay
      return contextDirection === OpenDirection.LEFT
        ? overlayContext.percentOpenLeft
        : overlayContext.percentOpenRight;
    }
    // Return the open percentage of the active swipe direction
    return overlayContext.openDirection === OpenDirection.LEFT
      ? overlayContext.percentOpenLeft
      : overlayContext.percentOpenRight;
  }, [overlayContext]);

  return {
    ...overlayContext,
    open,
    percentOpen,
  };
}

const styles = StyleSheet.create({
  underlay: {
    ...StyleSheet.absoluteFillObject,
  },
  flex: {
    flex: 1,
  },
});
