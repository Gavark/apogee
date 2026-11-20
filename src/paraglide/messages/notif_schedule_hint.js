/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ timezone: NonNullable<unknown> }} Notif_Schedule_HintInputs */



/**
* | output |
* | --- |
* | "At most one notification a day, around 6 pm (your account's time zone: {timezone})." |
*
* @param {Notif_Schedule_HintInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_schedule_hint = /** @type {((inputs: Notif_Schedule_HintInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Schedule_HintInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`At most one notification a day, around 6 pm (your account's time zone: ${i?.timezone}).`)
	return /** @type {LocalizedString} */ (`Au plus une notification par jour, vers 18 h (fuseau horaire de votre compte : ${i?.timezone}).`)
});