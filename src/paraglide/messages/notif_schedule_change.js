/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Notif_Schedule_ChangeInputs */



/**
* | output |
* | --- |
* | "Change time zone" |
*
* @param {Notif_Schedule_ChangeInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_schedule_change = /** @type {((inputs?: Notif_Schedule_ChangeInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Schedule_ChangeInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Change time zone")
	return /** @type {LocalizedString} */ ("Changer de fuseau horaire")
});