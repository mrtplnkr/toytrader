import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonEn from '../locales/en/common.json';
import commonLt from '../locales/lt/common.json';
import commonRu from '../locales/ru/common.json';
import loginEn from '../locales/en/login.json';
import loginLt from '../locales/lt/login.json';
import loginRu from '../locales/ru/login.json';
import authEn from '../locales/en/auth.json';
import authLt from '../locales/lt/auth.json';
import authRu from '../locales/ru/auth.json';
import aboutEn from '../locales/en/about.json';
import aboutLt from '../locales/lt/about.json';
import aboutRu from '../locales/ru/about.json';
import disclaimerEn from '../locales/en/disclaimer.json';
import disclaimerLt from '../locales/lt/disclaimer.json';
import disclaimerRu from '../locales/ru/disclaimer.json';
import itemEn from '../locales/en/item.json';
import itemLt from '../locales/lt/item.json';
import itemRu from '../locales/ru/item.json';
import parcelMachinePickerEn from '../locales/en/parcelMachinePicker.json';
import parcelMachinePickerLt from '../locales/lt/parcelMachinePicker.json';
import parcelMachinePickerRu from '../locales/ru/parcelMachinePicker.json';
import myToysEn from '../locales/en/myToys.json';
import myToysLt from '../locales/lt/myToys.json';
import myToysRu from '../locales/ru/myToys.json';
import inPostEn from '../locales/en/inPost.json';
import inPostLt from '../locales/lt/inPost.json';
import inPostRu from '../locales/ru/inPost.json';
import listEn from '../locales/en/list.json';
import listLt from '../locales/lt/list.json';
import listRu from '../locales/ru/list.json';
import shipmentResultEn from '../locales/en/shipmentResult.json';
import shipmentResultLt from '../locales/lt/shipmentResult.json';
import shipmentResultRu from '../locales/ru/shipmentResult.json';
import helpEn from '../locales/en/help.json';
import helpLt from '../locales/lt/help.json';
import helpRu from '../locales/ru/help.json';
import addNewToyEn from '../locales/en/addNewToy.json';
import addNewToyLt from '../locales/lt/addNewToy.json';
import addNewToyRu from '../locales/ru/addNewToy.json';
import addNewOfferEn from '../locales/en/addNewOffer.json';
import addNewOfferLt from '../locales/lt/addNewOffer.json';
import addNewOfferRu from '../locales/ru/addNewOffer.json';
import profileEn from '../locales/en/profile.json';
import profileLt from '../locales/lt/profile.json';
import profileRu from '../locales/ru/profile.json';
import myOffersEn from '../locales/en/myOffers.json';
import myOffersLt from '../locales/lt/myOffers.json';
import myOffersRu from '../locales/ru/myOffers.json';
import publicEn from '../locales/en/public.json';
import publicLt from '../locales/lt/public.json';
import publicRu from '../locales/ru/public.json';

export const SUPPORTED_LANGUAGES = ['en', 'lt', 'ru'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

const STORAGE_KEY = 'toytrader-lang';

function getSavedLanguage(): SupportedLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (SUPPORTED_LANGUAGES as readonly string[]).includes(saved)) {
      return saved as SupportedLanguage;
    }
  } catch (err) {
    // localStorage unavailable (e.g. private browsing) - fall through to default
  }
  return 'en';
}

export function setLanguage(lang: SupportedLanguage) {
  i18next.changeLanguage(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (err) {
    // localStorage unavailable - language still changes for this session
  }
}

i18next
  .use(initReactI18next)
  .init({
    lng: getSavedLanguage(),
    fallbackLng: 'en',
    ns: [
      'common', 'login', 'auth', 'about', 'disclaimer', 'item', 'parcelMachinePicker',
      'myToys', 'inPost', 'list', 'shipmentResult', 'help', 'addNewToy', 'addNewOffer', 'profile',
      'myOffers', 'public',
    ],
    defaultNS: 'common',
    resources: {
      en: {
        common: commonEn, login: loginEn, auth: authEn, about: aboutEn, disclaimer: disclaimerEn,
        item: itemEn, parcelMachinePicker: parcelMachinePickerEn, myToys: myToysEn, inPost: inPostEn,
        list: listEn, shipmentResult: shipmentResultEn, help: helpEn, addNewToy: addNewToyEn,
        addNewOffer: addNewOfferEn, profile: profileEn, myOffers: myOffersEn, public: publicEn,
      },
      lt: {
        common: commonLt, login: loginLt, auth: authLt, about: aboutLt, disclaimer: disclaimerLt,
        item: itemLt, parcelMachinePicker: parcelMachinePickerLt, myToys: myToysLt, inPost: inPostLt,
        list: listLt, shipmentResult: shipmentResultLt, help: helpLt, addNewToy: addNewToyLt,
        addNewOffer: addNewOfferLt, profile: profileLt, myOffers: myOffersLt, public: publicLt,
      },
      ru: {
        common: commonRu, login: loginRu, auth: authRu, about: aboutRu, disclaimer: disclaimerRu,
        item: itemRu, parcelMachinePicker: parcelMachinePickerRu, myToys: myToysRu, inPost: inPostRu,
        list: listRu, shipmentResult: shipmentResultRu, help: helpRu, addNewToy: addNewToyRu,
        addNewOffer: addNewOfferRu, profile: profileRu, myOffers: myOffersRu, public: publicRu,
      },
    },
    interpolation: { escapeValue: false },
  });

export default i18next;
