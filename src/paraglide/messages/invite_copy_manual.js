/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Invite_Copy_ManualInputs */



/**
* | output |
* | --- |
* | "Link selected: copy it by hand." |
*
* @param {Invite_Copy_ManualInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const invite_copy_manual = /** @type {((inputs?: Invite_Copy_ManualInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Invite_Copy_ManualInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Link selected: copy it by hand.")
	return /** @type {LocalizedString} */ ("Lien sélectionné : copiez-le à la main.")
});