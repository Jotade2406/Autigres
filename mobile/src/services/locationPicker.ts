export interface PickedLocation {
  lat:     number;
  lng:     number;
  address: string;
}

type Callback = (result: PickedLocation) => void;

let _cb: Callback | null = null;

export function registerPickerCallback(cb: Callback) { _cb = cb; }

export function resolvePickerCallback(result: PickedLocation) {
  _cb?.(result);
  _cb = null;
}
