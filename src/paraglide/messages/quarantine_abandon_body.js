/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quarantine_Abandon_BodyInputs */



/**
* | output |
* | --- |
* | "This change will never be sent. If it was already recorded, correct the stock by hand." |
*
* @param {Quarantine_Abandon_BodyInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const quarantine_abandon_body = /** @type {((inputs?: Quarantine_Abandon_BodyInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quarantine_Abandon_BodyInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("This change will never be sent. If it was already recorded, correct the stock by hand.")
	return /** @type {LocalizedString} */ ("Ce geste ne sera jamais envoyé. S'il a déjà été pris en compte, corrigez le stock à la main.")
});