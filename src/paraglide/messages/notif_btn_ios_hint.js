/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Notif_Btn_Ios_HintInputs */



/**
* | output |
* | --- |
* | "Install Apogée on your home screen to receive notifications." |
*
* @param {Notif_Btn_Ios_HintInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_btn_ios_hint = /** @type {((inputs?: Notif_Btn_Ios_HintInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Btn_Ios_HintInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Install Apogée on your home screen to receive notifications.")
	return /** @type {LocalizedString} */ ("Installez Apogée sur l'écran d'accueil pour recevoir les notifications.")
});