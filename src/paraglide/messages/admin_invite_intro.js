/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Invite_IntroInputs */



/**
* | output |
* | --- |
* | "A new household is created by the person who signs up with this link." |
*
* @param {Admin_Invite_IntroInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_invite_intro = /** @type {((inputs?: Admin_Invite_IntroInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Invite_IntroInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("A new household is created by the person who signs up with this link.")
	return /** @type {LocalizedString} */ ("Un nouveau foyer est créé par la personne qui s'inscrit avec ce lien.")
});