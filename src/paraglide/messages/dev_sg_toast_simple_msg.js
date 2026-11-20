/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Dev_Sg_Toast_Simple_MsgInputs */



/**
* | output |
* | --- |
* | "Place saved." |
*
* @param {Dev_Sg_Toast_Simple_MsgInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const dev_sg_toast_simple_msg = /** @type {((inputs?: Dev_Sg_Toast_Simple_MsgInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dev_Sg_Toast_Simple_MsgInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Place saved.")
	return /** @type {LocalizedString} */ ("Lieu enregistré.")
});