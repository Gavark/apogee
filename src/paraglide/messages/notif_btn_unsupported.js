/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Notif_Btn_UnsupportedInputs */



/**
* | output |
* | --- |
* | "This browser does not support notifications." |
*
* @param {Notif_Btn_UnsupportedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_btn_unsupported = /** @type {((inputs?: Notif_Btn_UnsupportedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Btn_UnsupportedInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("This browser does not support notifications.")
	return /** @type {LocalizedString} */ ("Ce navigateur ne prend pas en charge les notifications.")
});