/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Notif_Btn_DeniedInputs */



/**
* | output |
* | --- |
* | "Notifications are blocked for this site: allow them in your browser settings." |
*
* @param {Notif_Btn_DeniedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_btn_denied = /** @type {((inputs?: Notif_Btn_DeniedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Btn_DeniedInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Notifications are blocked for this site: allow them in your browser settings.")
	return /** @type {LocalizedString} */ ("Les notifications sont bloquées pour ce site : autorisez-les dans les réglages du navigateur.")
});