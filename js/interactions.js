/* 振动、点击、分段滑块与移动端按压反馈。 */
      function vibrateTap() {
        if (appSettings.vibration === "off") return;
        if (navigator.vibrate) {
          try {
            navigator.vibrate(12);
          } catch (e) {}
        }
      }

      function bindUnifiedVibration() {
        document.addEventListener("click", function (e) {
          var sliderTrack = e.target.closest(".tabs, .direction-tabs");
          if (sliderTrack && Date.now() < (sliderTrack._sliderSuppressClickUntil || 0)) return;
          var target = e.target.closest("button, #resultBox");
          if (!target) return;
          vibrateTap();
        }, true);
      }

      function runAfterMobilePressFeedback(node, action) {
        var ready = mobileActionReady.get(node);
        if (!ready) {
          action();
          return;
        }
        mobileActionReady.delete(node);
        ready.then(function (allowed) {
          if (allowed !== false) action();
        });
      }

      function bindTap(node, fn) {
        var startX = 0;
        var startY = 0;
        var startTime = 0;
        var tracking = false;
        var moved = false;
        var cancelClickUntil = 0;
        var MOVE_LIMIT = 10;
        var TIME_LIMIT = 900;

        node.addEventListener("pointerdown", function (e) {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          startX = e.clientX;
          startY = e.clientY;
          startTime = Date.now();
          tracking = true;
          moved = false;
        });

        node.addEventListener("pointermove", function (e) {
          if (!tracking) return;
          var dx = Math.abs(e.clientX - startX);
          var dy = Math.abs(e.clientY - startY);
          if (dx > MOVE_LIMIT || dy > MOVE_LIMIT) {
            moved = true;
          }
        });

        node.addEventListener("pointercancel", function () {
          tracking = false;
          moved = false;
          cancelClickUntil = Date.now() + 500;
        });

        node.addEventListener("pointerup", function (e) {
          if (!tracking) return;

          var dx = Math.abs(e.clientX - startX);
          var dy = Math.abs(e.clientY - startY);
          var elapsed = Date.now() - startTime;

          tracking = false;

          if (moved || dx > MOVE_LIMIT || dy > MOVE_LIMIT || elapsed > TIME_LIMIT) {
            cancelClickUntil = Date.now() + 500;
            return;
          }
          cancelClickUntil = 0;
        });

        node.addEventListener("click", function (e) {
          var isKeyboardOrProgrammatic = e.detail === 0;
          if (!isKeyboardOrProgrammatic && Date.now() < cancelClickUntil) {
            e.preventDefault();
            e.stopPropagation();
            cancelClickUntil = 0;
            return;
          }
          cancelClickUntil = 0;
          runAfterMobilePressFeedback(node, function () { fn(e); });
        });
      }

      function bindDraggableSegmentedSlider(track, values, commitValue) {
        if (!track || !values || values.length !== 2) return;

        var tracking = false;
        var dragging = false;
        var startedOnSelectedSegment = false;
        var pointerId = null;
        var startX = 0;
        var startY = 0;
        var rect = null;
        var thumbWidth = 0;
        var thumbLeft = 0;
        var travel = 0;
        var grabOffset = 0;
        var progress = 0;
        var pendingProgress = null;
        var frameId = 0;
        var magneticFrameId = 0;
        var magneticTargetProgress = null;
        var magneticLastTime = 0;
        var magneticCaught = false;
        var magneticVelocity = 0;
        var magneticSpringMode = null;
        var holdTimer = 0;
        var latestClientX = 0;
        var pendingSnapValue = null;
        var IOS_SPRING_STIFFNESS = 503.551;
        var IOS_SPRING_DAMPING = 44.8799;

        function clamp(value, min, max) {
          return Math.max(min, Math.min(max, value));
        }

        function activeIndex() {
          return track.getAttribute("data-active") === values[1] ? 1 : 0;
        }

        function clearFrame() {
          if (!frameId) return;
          cancelAnimationFrame(frameId);
          frameId = 0;
        }

        function renderProgress(value) {
          progress = clamp(value, 0, 1);
          track.style.setProperty("--slider-drag-x", (progress * travel).toFixed(3) + "px");
        }

        function queueProgress(value) {
          pendingProgress = clamp(value, 0, 1);
          if (frameId) return;
          frameId = requestAnimationFrame(function () {
            frameId = 0;
            if (pendingProgress === null) return;
            renderProgress(pendingProgress);
            pendingProgress = null;
          });
        }

        function flushProgress() {
          clearFrame();
          if (pendingProgress === null) return;
          renderProgress(pendingProgress);
          pendingProgress = null;
        }

        function progressFromClientX(clientX) {
          if (!rect || travel <= 0) return activeIndex();
          var centerStart = rect.left + thumbLeft + thumbWidth / 2;
          return clamp((clientX - grabOffset - centerStart) / travel, 0, 1);
        }

        function absoluteProgressFromClientX(clientX) {
          if (!rect || travel <= 0) return activeIndex();
          var centerStart = rect.left + thumbLeft + thumbWidth / 2;
          return clamp((clientX - centerStart) / travel, 0, 1);
        }

        function indexFromClientX(clientX) {
          if (!rect) return activeIndex();
          return clientX < rect.left + rect.width / 2 ? 0 : 1;
        }

        function stopMagneticFollow() {
          if (magneticFrameId) cancelAnimationFrame(magneticFrameId);
          magneticFrameId = 0;
          magneticTargetProgress = null;
          magneticLastTime = 0;
          magneticCaught = false;
          magneticVelocity = 0;
          magneticSpringMode = null;
        }

        function clearHoldTimer() {
          if (!holdTimer) return;
          window.clearTimeout(holdTimer);
          holdTimer = 0;
        }

        function activateDragging() {
          if (!tracking || dragging) return;
          clearHoldTimer();
          dragging = true;
          track.classList.add("slider-dragging");
          if (track.setPointerCapture && pointerId !== null) {
            try { track.setPointerCapture(pointerId); } catch (error) {}
          }
          if (startedOnSelectedSegment) {
            queueProgress(progressFromClientX(latestClientX));
          } else {
            queueMagneticProgress(absoluteProgressFromClientX(latestClientX));
          }
        }

        function runMagneticFollow(timestamp) {
          magneticFrameId = 0;
          if (magneticTargetProgress === null) return;
          if (magneticSpringMode === "follow" && (!dragging || startedOnSelectedSegment)) return;

          var dt = (magneticLastTime ? Math.min(32, timestamp - magneticLastTime) : 16.67) / 1000;
          magneticLastTime = timestamp;
          var nextProgress = progress;
          var remaining = dt;

          while (remaining > 0) {
            var step = Math.min(remaining, 1 / 120);
            var acceleration = IOS_SPRING_STIFFNESS * (magneticTargetProgress - nextProgress)
              - IOS_SPRING_DAMPING * magneticVelocity;
            magneticVelocity += acceleration * step;
            nextProgress += magneticVelocity * step;
            remaining -= step;
          }
          nextProgress = clamp(nextProgress, 0, 1);

          if (Math.abs(magneticTargetProgress - nextProgress) * travel <= 2
            && Math.abs(magneticVelocity) * travel <= 30) {
            nextProgress = magneticTargetProgress;
            magneticVelocity = 0;
            magneticCaught = true;
          }

          renderProgress(nextProgress);
          if (!magneticCaught) {
            magneticFrameId = requestAnimationFrame(runMagneticFollow);
          } else if (magneticSpringMode === "snap") {
            var value = pendingSnapValue;
            pendingSnapValue = null;
            if (value !== null && track.getAttribute("data-active") !== value) commitValue(value);
            clearInteractionStyles();
          }
        }

        function queueMagneticProgress(value) {
          magneticTargetProgress = clamp(value, 0, 1);
          magneticSpringMode = "follow";
          if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            magneticCaught = true;
            renderProgress(magneticTargetProgress);
            return;
          }
          if (magneticCaught) {
            queueProgress(magneticTargetProgress);
            return;
          }
          if (!magneticFrameId) magneticFrameId = requestAnimationFrame(runMagneticFollow);
        }

        function clearInteractionStyles() {
          clearHoldTimer();
          stopMagneticFollow();
          track.classList.remove("slider-dragging", "slider-snapping");
          track.style.removeProperty("--slider-drag-x");
          track.style.removeProperty("--slider-snap-duration");
        }

        function finalizePendingSnap() {
          var value = pendingSnapValue;
          pendingSnapValue = null;
          if (value !== null && track.getAttribute("data-active") !== value) commitValue(value);
          clearInteractionStyles();
        }

        function snapTo(targetIndex, shouldCommit) {
          flushProgress();
          var targetProgress = targetIndex ? 1 : 0;
          var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          if (reduceMotion) {
            renderProgress(targetProgress);
            if (shouldCommit && track.getAttribute("data-active") !== values[targetIndex]) commitValue(values[targetIndex]);
            clearInteractionStyles();
            return;
          }

          if (magneticFrameId) cancelAnimationFrame(magneticFrameId);
          magneticFrameId = 0;
          magneticTargetProgress = targetProgress;
          magneticLastTime = 0;
          magneticCaught = false;
          magneticSpringMode = "snap";
          pendingSnapValue = shouldCommit ? values[targetIndex] : null;
          track.classList.remove("slider-snapping");
          track.classList.add("slider-dragging");
          magneticFrameId = requestAnimationFrame(runMagneticFollow);
        }

        function releasePointer() {
          if (pointerId === null || !track.hasPointerCapture || !track.hasPointerCapture(pointerId)) return;
          try { track.releasePointerCapture(pointerId); } catch (error) {}
        }

        track.addEventListener("pointerdown", function (e) {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          finalizePendingSnap();

          var pseudoStyle = window.getComputedStyle(track, "::before");
          var trackStyle = window.getComputedStyle(track);
          var edgeInset = parseFloat(trackStyle.getPropertyValue("--slider-edge-inset")) || 0;
          rect = track.getBoundingClientRect();
          thumbWidth = parseFloat(pseudoStyle.width) || 0;
          if (pseudoStyle.boxSizing !== "border-box") {
            thumbWidth += (parseFloat(pseudoStyle.borderLeftWidth) || 0)
              + (parseFloat(pseudoStyle.borderRightWidth) || 0);
          }
          thumbLeft = track.clientLeft + edgeInset;
          travel = Math.max(0, track.clientWidth - edgeInset * 2 - thumbWidth);
          progress = activeIndex();
          startX = e.clientX;
          startY = e.clientY;
          latestClientX = e.clientX;
          pointerId = e.pointerId;
          tracking = true;
          dragging = false;

          var currentThumbLeft = rect.left + thumbLeft + progress * travel;
          startedOnSelectedSegment = indexFromClientX(e.clientX) === activeIndex();
          grabOffset = e.clientX - (currentThumbLeft + thumbWidth / 2);
          holdTimer = window.setTimeout(function () {
            holdTimer = 0;
            startedOnSelectedSegment = false;
            activateDragging();
          }, 160);
        });

        track.addEventListener("pointermove", function (e) {
          if (!tracking || e.pointerId !== pointerId) return;
          latestClientX = e.clientX;
          var dx = e.clientX - startX;
          var dy = e.clientY - startY;
          var threshold = e.pointerType === "mouse" ? 4 : 6;

          if (!dragging) {
            if (Math.abs(dy) > threshold && Math.abs(dy) > Math.abs(dx)) {
              clearHoldTimer();
              tracking = false;
              pointerId = null;
              return;
            }
            if (Math.abs(dx) < threshold) return;
            activateDragging();
          }

          if (e.cancelable) e.preventDefault();
          if (startedOnSelectedSegment) {
            queueProgress(progressFromClientX(e.clientX));
          } else {
            queueMagneticProgress(absoluteProgressFromClientX(e.clientX));
          }
        }, { passive: false });

        track.addEventListener("pointerup", function (e) {
          if (!tracking || e.pointerId !== pointerId) return;
          clearHoldTimer();
          tracking = false;
          releasePointer();
          pointerId = null;
          if (!dragging) return;

          dragging = false;
          if (startedOnSelectedSegment) {
            flushProgress();
          }
          var targetIndex = startedOnSelectedSegment
            ? (progress >= 0.5 ? 1 : 0)
            : indexFromClientX(e.clientX);
          track._sliderSuppressClickUntil = Date.now() + 600;
          snapTo(targetIndex, values[targetIndex] !== track.getAttribute("data-active"));
        });

        track.addEventListener("pointercancel", function (e) {
          if (!tracking || e.pointerId !== pointerId) return;
          clearHoldTimer();
          tracking = false;
          releasePointer();
          pointerId = null;
          clearFrame();
          pendingProgress = null;
          if (!dragging) return;
          dragging = false;
          stopMagneticFollow();
          track._sliderSuppressClickUntil = Date.now() + 600;
          snapTo(activeIndex(), false);
        });

        track.addEventListener("click", function (e) {
          if (Date.now() >= (track._sliderSuppressClickUntil || 0)) return;
          e.preventDefault();
          e.stopImmediatePropagation();
        }, true);
      }

      function bindMobilePressFeedback() {
        var activePress = null;
        var buttonStates = new WeakMap();

        function isMobileViewport() {
          return window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
        }

        function pressKind(button) {
          if (button.matches(".btn-primary, #settingsDone, .notice-ok, .changelog-ok, .confirm-ok")) {
            return "primary";
          }
          if (button.matches("[aria-label]:not(.btn-primary)")) return "icon";
          return "secondary";
        }

        function shouldDeferAction(button) {
          return button.matches(".settings-open, #noticeBtn, .notice-x, .settings-back, .notice-back, .notice-ok, .changelog-ok, .changelog-never, .confirm-cancel, .confirm-ok");
        }

        function isCrystalDialogTrigger(button) {
          return !!button &&
            document.body.classList.contains("appearance-crystal") &&
            button.matches(".settings-open, #noticeBtn");
        }

        function isDialogTrigger(button) {
          return !!button && button.matches(".settings-open, #noticeBtn");
        }

        function usesManagedPressFeedback(button) {
          return isMobileViewport() || isDialogTrigger(button);
        }

        function pressTiming(kind, button) {
          if (isCrystalDialogTrigger(button)) {
            return { press: 90, minVisible: 90, release: 120 };
          }
          if (isDialogTrigger(button)) {
            return { press: 80, minVisible: 80, release: 140 };
          }
          if (kind === "primary") return { press: 80, minVisible: 90, release: 180 };
          if (kind === "icon") return { press: 100, minVisible: 0, release: 220 };
          return { press: 100, minVisible: 0, release: 220 };
        }

        function animationFrameFromStyle(style, kind) {
          var frame = { transform: style.transform };
          if (kind === "primary") {
            frame.filter = style.filter;
            frame.boxShadow = style.boxShadow;
          }
          return frame;
        }

        function canAnimateButton(button) {
          if (!button || button.disabled) return false;
          if (button.matches(".tab, .direction-tab, #settingsReset")) return false;
          return !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        }

        function removeFeedbackClasses(button) {
          button.classList.remove("mobile-press-active", "mobile-press-releasing", "mobile-press-primary", "mobile-press-secondary", "mobile-press-icon", "mobile-press-dialog");
        }

        function resolveDeferredAction(state, allowed) {
          if (!state || !state.resolveAction) return;
          state.resolveAction(allowed === true);
          state.resolveAction = null;
        }

        function resolveDeferredActionAfterRestPaint(state) {
          if (!state || !state.resolveAction) return;
          if (typeof window.requestAnimationFrame !== "function") {
            window.setTimeout(function () {
              resolveDeferredAction(state, true);
            }, 16);
            return;
          }

          /* The first frame paints the fully-restored button. The action is
             released on the following frame so the overlay cannot hide that
             final visual state in the same rendering cycle. */
          window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
              resolveDeferredAction(state, true);
            });
          });
        }

        function cancelState(state, allowAction) {
          if (!state || state.cancelled) return;
          state.cancelled = true;
          if (state.releaseTimer) window.clearTimeout(state.releaseTimer);
          if (state.pressAnimation) state.pressAnimation.cancel();
          if (state.releaseAnimation) state.releaseAnimation.cancel();
          resolveDeferredAction(state, allowAction);
          removeFeedbackClasses(state.button);
          buttonStates.delete(state.button);
        }

        function startRelease(state) {
          if (!state || state.cancelled || state.releasing) return;
          state.releasing = true;
          var button = state.button;
          var timing = state.timing;
          var crystalDialogTrigger = isCrystalDialogTrigger(button);
          var openDialogDuringRelease = isDialogTrigger(button);
          var waitForReleaseBeforeAction = false;

          var pressedStyle = window.getComputedStyle(button);
          var fromState = animationFrameFromStyle(pressedStyle, state.kind);
          if (state.pressAnimation) state.pressAnimation.cancel();
          button.classList.add("mobile-press-releasing");
          button.classList.remove("mobile-press-active");
          void button.offsetWidth;
          /* Reuse the idle state captured before pointerdown. On touch Safari
             :hover can remain latched after the tap; measuring here would make
             that raised hover transform the rebound's final destination. */
          var toState = state.restingState;
          if (!toState) {
            var restingStyle = window.getComputedStyle(button);
            toState = animationFrameFromStyle(restingStyle, state.kind);
          }

          if (typeof button.animate !== "function") {
            removeFeedbackClasses(button);
            buttonStates.delete(button);
            resolveDeferredAction(state, true);
            return;
          }

          var releaseFrames = [fromState, toState];
          var releaseEasing = state.kind === "primary"
            ? "cubic-bezier(0.22, 0.80, 0.25, 1)"
            : "cubic-bezier(0.16, 1, 0.30, 1)";

          if (crystalDialogTrigger) {
            /* Keep the toolbar button on its original vertical baseline while
               preserving a small scale-only rebound. The previous overshoot
               easing also overshot translateY, making the pressed trigger sit
               visibly above its idle neighbour while the dialog was opening. */
            var scaleReboundState = Object.assign({}, toState, {
              offset: 0.72,
              transform: "translateY(-1px) scale(1.01)",
              easing: "cubic-bezier(0.2, 0, 0, 1)"
            });
            releaseFrames = [
              Object.assign({}, fromState, {
                offset: 0,
                easing: "cubic-bezier(0.34, 1, 0.64, 1)"
              }),
              scaleReboundState,
              Object.assign({}, toState, { offset: 1 })
            ];
            releaseEasing = "linear";
          } else if (openDialogDuringRelease) {
            /* Standard appearances use the same responsive overlap as the
               crystal theme, with a shorter scale-only rebound. */
            var standardScaleReboundState = Object.assign({}, toState, {
              offset: 0.76,
              transform: "translateY(0) scale(1.006)",
              easing: "cubic-bezier(0.2, 0, 0, 1)"
            });
            releaseFrames = [
              Object.assign({}, fromState, {
                offset: 0,
                easing: "cubic-bezier(0.34, 1, 0.64, 1)"
              }),
              standardScaleReboundState,
              Object.assign({}, toState, { offset: 1 })
            ];
            releaseEasing = "linear";
          }

          var releaseAnimation = button.animate(releaseFrames, {
            duration: timing.release,
            easing: releaseEasing
          });
          state.releaseAnimation = releaseAnimation;
          /* Dialog triggers open as their rebound starts. The WAAPI rebound
             keeps running independently, so mounting the overlay cannot delay
             or truncate the button's return to its captured resting state. */
          if (openDialogDuringRelease || !waitForReleaseBeforeAction) {
            resolveDeferredAction(state, true);
          }
          releaseAnimation.finished.then(function () {
            if (buttonStates.get(button) !== state) return;
            removeFeedbackClasses(button);
            buttonStates.delete(button);
            if (waitForReleaseBeforeAction) resolveDeferredActionAfterRestPaint(state);
          }, function () {
            if (buttonStates.get(button) !== state) return;
            removeFeedbackClasses(button);
            buttonStates.delete(button);
            if (waitForReleaseBeforeAction) resolveDeferredActionAfterRestPaint(state);
          });
        }

        function scheduleRelease(state) {
          if (!state || state.cancelled || !state.released || state.releasing) return;
          var remainingVisible = Math.max(0, state.timing.minVisible - (performance.now() - state.startedAt));
          if (state.releaseTimer) window.clearTimeout(state.releaseTimer);
          state.releaseTimer = window.setTimeout(function () {
            state.releaseTimer = null;
            startRelease(state);
          }, remainingVisible);
        }

        function finishPress(cancelled) {
          if (!activePress) return;
          var state = activePress;
          activePress = null;
          if (cancelled) {
            cancelState(state, false);
            return;
          }
          state.released = true;
          scheduleRelease(state);
        }

        function beginPress(button, pointerId, startX, startY) {
          var previousState = buttonStates.get(button);
          if (previousState) cancelState(previousState, false);
          var kind = pressKind(button);
          var timing = pressTiming(kind, button);
          document.body.classList.add("mobile-press-measuring");
          var restingStyle = window.getComputedStyle(button);
          var restingState = animationFrameFromStyle(restingStyle, kind);
          document.body.classList.remove("mobile-press-measuring");
          button.classList.add("mobile-press-" + kind, "mobile-press-active");
          var pressedStyle = window.getComputedStyle(button);
          var pressedState = animationFrameFromStyle(pressedStyle, kind);
          var state = {
            button: button,
            kind: kind,
            timing: timing,
            pointerId: pointerId,
            startX: startX,
            startY: startY,
            startedAt: performance.now(),
            released: false,
            releasing: false,
            cancelled: false,
            releaseTimer: null,
            pressAnimation: null,
            releaseAnimation: null,
            restingState: restingState,
            resolveAction: null
          };
          if (shouldDeferAction(button)) {
            mobileActionReady.set(button, new Promise(function (resolve) {
              state.resolveAction = resolve;
            }));
          }
          buttonStates.set(button, state);

          if (typeof button.animate === "function") {
            state.pressAnimation = button.animate([
              restingState,
              pressedState
            ], {
              duration: timing.press,
              easing: isDialogTrigger(button)
                ? "cubic-bezier(0.2, 0, 0, 1)"
                : kind === "primary"
                ? "cubic-bezier(0.20, 0, 0, 1)"
                : "cubic-bezier(0.20, 0.70, 0.20, 1)",
              fill: "both"
            });
          }
          return state;
        }

        document.addEventListener("pointerdown", function (e) {
          var button = e.target.closest("button");
          if (!usesManagedPressFeedback(button) || e.button !== 0) return;
          if (!canAnimateButton(button)) return;
          if (activePress) finishPress(true);
          activePress = beginPress(button, e.pointerId, e.clientX, e.clientY);
        });

        document.addEventListener("pointermove", function (e) {
          if (!activePress || e.pointerId !== activePress.pointerId) return;
          if (Math.abs(e.clientX - activePress.startX) > 10 || Math.abs(e.clientY - activePress.startY) > 10) {
            finishPress(true);
          }
        });

        document.addEventListener("pointerup", function (e) {
          if (!activePress || e.pointerId !== activePress.pointerId) return;
          finishPress(false);
        });

        document.addEventListener("pointercancel", function (e) {
          if (!activePress || e.pointerId !== activePress.pointerId) return;
          finishPress(true);
        });

        document.addEventListener("click", function (e) {
          var button = e.target.closest("button");
          if (!usesManagedPressFeedback(button) || e.detail === 0) return;
          if (!canAnimateButton(button) || buttonStates.has(button)) return;
          var fallbackState = beginPress(button, null, 0, 0);
          fallbackState.released = true;
          scheduleRelease(fallbackState);
        }, true);

        window.addEventListener("blur", function () { finishPress(true); });
      }
