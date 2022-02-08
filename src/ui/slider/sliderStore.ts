import { createContext } from '../../base/context';
import { derived, writable } from '../../base/stores';

export function createSliderStore() {
  const dragging = writable(false);
  const pointing = writable(false);

  return {
    /**
     * The current slider value.
     */
    value: writable(50),
    /**
     * The value at which the device pointer is pointing to inside the slider.
     */
    pointerValue: writable(0),
    /**
     * Whether the slider thumb is currently being dragged.
     */
    dragging,
    /**
     * Whether a device pointer is within the slider bounds.
     */
    pointing,
    /**
     * Whether the scrubber is being interacted with.
     */
    interactive: derived(
      [dragging, pointing],
      ([$dragging, $pointing]) => $dragging || $pointing
    )
  };
}

export const sliderStoreContext = createContext(createSliderStore);
