/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Household_Invite_IntroInputs */



/**
* | output |
* | --- |
* | "Create a link valid for 7 days: whoever opens it joins this household and sees the same cellar." |
*
* @param {Household_Invite_IntroInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const household_invite_intro = /** @type {((inputs?: Household_Invite_IntroInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Household_Invite_IntroInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Create a link valid for 7 days: whoever opens it joins this household and sees the same cellar.")
	return /** @type {LocalizedString} */ ("Créez un lien valable 7 jours : la personne qui l'ouvre rejoint ce foyer et voit la même cave.")
});