import { DOMEvent, isFunction, isString, isUndefined } from 'maverick.js/std';

import { coerceToError } from '../../utils/error';
import { loadScript } from '../../utils/network';
import type { DashConstructor, DashConstructorLoader, DashLibrary } from './types';
import type { MediaContext } from '../../core/api/media-context';

interface LoadDASHConstructorCallbacks {
  onLoadStart?: () => void;
  onLoaded?: (ctor: DashConstructor) => void;
  onLoadError?: (err: Error) => void;
}


export class DASHLibLoader {
  constructor(
    private _lib : DashLibrary, private _ctx : MediaContext, private _callback :  (ctor : DashConstructor) => void,
    ) {
    this._startLoading();
  }

 private async _startLoading() {
    if (__DEV__) this._ctx.logger?.info('🏗️ Loading DASH Library');

    const callbacks : LoadDASHConstructorCallbacks = {
      onLoadStart: this._onLoadStart.bind(this),
      onLoaded: this._onLoaded.bind(this),
      onLoadError: this._onLoadError.bind(this),
    };

    // If not a string it'll return undefined.
    let ctor = await loadDASHScript(this._lib, callbacks);

    // If it's not a remote source, it must of been passed in directly as a static/dynamic import.
    if (isUndefined(ctor) && !isString(this._lib)) ctor = await importDASH(this._lib, callbacks);

    // We failed loading the constructor.
    if (!ctor) return null;

    // Not supported.
    if (!window.dashjs.supportsMediaSource()) {
      const message = '[vidstack] `dash.js` is not supported in this environment';
      if (__DEV__) this._ctx.logger?.error(message);
      this._ctx.player.dispatch(new DOMEvent<void>('dash-unsupported'));
      this._ctx.delegate._notify('error', { message, code: 4 });
      return null;
    }

    return ctor;
  }

  private _onLoadStart() {
    if (__DEV__) {
      this._ctx.logger
        ?.infoGroup('Starting to load `dash.js`')
        .labelledLog('URL', this._lib)
        .dispatch();
    }

    this._ctx.player.dispatch(new DOMEvent<void>('dash-lib-load-start'));
  }

  private _onLoaded(ctor: DashConstructor) {
    if (__DEV__) {
      this._ctx.logger
        ?.infoGroup('Loaded `dash.js`')
        .labelledLog('Library', this._lib)
        .labelledLog('Constructor', ctor)
        .dispatch();
    }

    this._ctx.player.dispatch(
      new DOMEvent<DashConstructor>('dash-lib-loaded', {
        detail: ctor,
      }),
    );

    this._callback(ctor);
  }

  private _onLoadError(e : any) {
    const error = coerceToError(e);

    if (__DEV__) {
      this._ctx.logger
        ?.errorGroup('[vidstack] Failed to load `dash.js`')
        .labelledLog('Library', this._lib)
        .labelledLog('Error', e)
        .dispatch();
    }

    this._ctx.player.dispatch(
      new DOMEvent<any>('dash-lib-load-error', {
        detail: error,
      }),
    );

    this._ctx.delegate._notify('error', {
      message: error.message,
      code: 4,
      error,
    });
  }
}

async function importDASH(loader: DashConstructor | DashConstructorLoader | undefined, callbacks : LoadDASHConstructorCallbacks = {}) {
  if (isUndefined(loader)) return undefined;
  callbacks.onLoadStart?.();

  // Must be static.
  if (loader.prototype && loader.prototype !== Function) {
    callbacks.onLoaded?.(loader as DashConstructor);
    return loader as DashConstructor;
  }

  try {
    const ctor = (await (loader as DashConstructorLoader)())?.default;

    if (ctor) {
      callbacks.onLoaded?.(ctor);
    } else {
      throw Error(
        __DEV__
          ? '[vidstack] failed importing `dash.js`. Dynamic import returned invalid constructor.'
          : '',
      );
    }

    return ctor;
  } catch (err) {
    callbacks.onLoadError?.(err as Error);
  }

  return undefined;
}

/**
 * Loads `hls.js` from the remote source given via `library` into the window namespace. This
 * is because `hls.js` in {currentYear} still doesn't provide a ESM export. This method will
 * return `undefined` if it fails to load the script. Listen to `lib-load-error` to be
 * notified of any failures.
 */
async function loadDASHScript(src : unknown, callbacks : LoadDASHConstructorCallbacks = {}) :Promise<DashConstructor | undefined> {
  if (!isString(src)) return undefined;

  callbacks.onLoadStart?.();

  try {
    await loadScript(src);
    if (!isFunction((window as any).dashjs.MediaPlayer)) {
      throw Error(
        __DEV__
          ? '[vidstack] failed loading `dash.js`. Could not find a valid `Dash` constructor on window'
          : '',
      );
    }

    const ctor = window.dashjs.MediaPlayer;
    callbacks.onLoaded?.(ctor);
    return ctor;
  } catch (err) {
    callbacks.onLoadError?.(err as Error);
  }

  return undefined;
}
