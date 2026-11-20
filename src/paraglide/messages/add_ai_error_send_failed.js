/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Ai_Error_Send_FailedInputs */



/**
* | output |
* | --- |
* | "Upload failed: the photo was not saved. Try again or enter the wine." |
*
* @param {Add_Ai_Error_Send_FailedInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const add_ai_error_send_failed = /** @type {((inputs?: Add_Ai_Error_Send_FailedInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Ai_Error_Send_FailedInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Upload failed: the photo was not saved. Try again or enter the wine.")
	return /** @type {LocalizedString} */ ("Envoi impossible : la photo n'a pas été enregistrée. Réessayez ou saisissez le vin.")
});