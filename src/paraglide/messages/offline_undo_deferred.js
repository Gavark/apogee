/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Offline_Undo_DeferredInputs */



/**
* | output |
* | --- |
* | "The undo will be applied when syncing" |
*
* @param {Offline_Undo_DeferredInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const offline_undo_deferred = /** @type {((inputs?: Offline_Undo_DeferredInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Offline_Undo_DeferredInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("The undo will be applied when syncing")
	return /** @type {LocalizedString} */ ("L'annulation sera appliquée à la synchronisation")
});