/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Dev_Sg_IntroInputs */



/**
* | output |
* | --- |
* | "Apogée's shared components. Check every block in light and dark, at 375 px wide." |
*
* @param {Dev_Sg_IntroInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const dev_sg_intro = /** @type {((inputs?: Dev_Sg_IntroInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dev_Sg_IntroInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Apogée's shared components. Check every block in light and dark, at 375 px wide.")
	return /** @type {LocalizedString} */ ("Les composants partagés d'Apogée. Vérifiez chaque bloc en clair et en sombre, à 375 px de large.")
});