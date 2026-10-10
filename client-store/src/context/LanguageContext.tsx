import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'km';

const translations = {
  en: {
    // Navigation & Tabs
    tab_home: 'Home',
    tab_shop: 'Shop',
    tab_gacha: 'Gacha',
    tab_orders: 'Orders',
    tab_profile: 'Game Account (Account)',

    // Header
    store_title: 'UCHIRO STORE',
    points_label: 'Points',
    open_store: 'Open Store',

    // Home
    home_hero_title: 'MYTHICAL LEVEL GAMING',
    home_hero_subtitle: 'Instant Delivery (Auto) • 14-Day Warranty • 100% Safe',
    in_stock_now: 'In Stock',
    in_stock_badge: 'In Stock',
    instant_delivery_badge: 'Instant Delivery (Auto)',
    out_of_stock: 'Sold Out',
    coming_soon: 'Coming Back Soon',
    filter_all: 'All',
    collections: 'Collections',
    featured_products: 'Featured Products',
    all_products: 'All Products →',
    view_all: 'View All',
    shop_now: 'Buy Now',

    // Shop
    shop_title: 'Gaming Catalog',
    shop_search_placeholder: 'Search accounts, items, fruits...',
    select_game_category: 'Select Game / Category',
    filter_accounts: 'Game Account (Account)',
    filter_gifts: 'Gift Items',
    filter_trades: 'Trade Items',
    filter_codes: 'Digital Code (Code)',
    sort_featured: 'Featured',
    sort_price_low: 'Price: Low to High',
    sort_price_high: 'Price: High to Low',
    sort_popular: 'Most Popular',

    // Product Detail
    specifications: 'Specifications',
    warranty_info: '14-Day Warranty',
    warranty_desc: 'Guaranteed valid for 14 days provided original authenticator and email access remain active.',
    viewers_watching: 'people viewing right now',
    buy_now: 'Buy Now',
    instant_buy: 'Buy Now',
    roblox_username_required: 'Please enter your Roblox username',
    roblox_username_label: 'Your Roblox Username',

    // Checkout & Payment
    checkout_title: 'Confirm Purchase',
    subtotal: 'Subtotal',
    discount: 'Discount',
    total_amount: 'Total Amount',
    apply_coupon: 'Apply Coupon',
    coupon_code: 'Coupon Code',
    apply: 'Apply',
    proceed_to_payment: 'Proceed to KHPay Checkout',
    payment_title: 'Scan to Pay with KHPay',
    payment_countdown: 'Payment window expires in',
    open_aba: 'Open ABA Mobile',
    open_bakong: 'Open Mobile Banking',
    copy_payment_data: 'Copy Payment Reference',
    verifying_payment: 'Verifying payment automatically...',
    payment_successful: 'Payment Confirmed!',

    // Delivered Order & Authenticator
    order_delivered: 'Order Delivered Successfully (Auto)',
    credentials_vault: 'Secure Credentials Vault',
    username: 'Username',
    password: 'Password',
    email: 'Email',
    email_password: 'Email Password',
    authenticator: 'Authenticator (2FA)',
    live_totp_code: 'Live 6-Digit Authenticator Code',
    expires_in: 'Expires in',
    refresh: 'Refresh Code',
    import_authenticator: 'Import to Authenticator App',
    view_backup_codes: 'View Backup Codes',
    copy: 'Copy',
    copied: 'Copied!',
    reveal: 'Reveal',
    hide: 'Hide',
    security_warning: 'Keep your authenticator and recovery email secure. Do not delete or remove them.',
    warranty_status_active: '14-Day Warranty Active',

    // Authenticator Modal
    import_modal_title: 'Import Authenticator',
    scan_qr: 'Scan QR Code',
    copy_setup_key: 'Copy Setup Key',
    copy_uri: 'Copy Authenticator URI',
    setup_steps: '1. Open Google Authenticator or 1Password\n2. Add new account\n3. Scan QR or paste setup key\n4. Authenticator will generate 6-digit codes automatically.',

    // Gacha & Rewards
    gacha_title: 'Mythical Reward Chest',
    gacha_subtitle: 'Blox Fruits & MM2 Points Rewards',
    spin_cost: 'Spin Cost: 100 Points',
    available_points: 'Available Points',
    spin_now: 'Spin for 100 Points',
    spinning: 'Summoning...',
    reward_congratulations: 'Congratulations!',
    redeem_coupon_from_points: 'Redeem $1 Coupon (100 Pts)',
    daily_reward: 'Claim Daily Points',
    claim_daily: 'Claim Points',
    streak_days: 'Day Streak',
    already_claimed_today: 'You already claimed points today (come back tomorrow)',

    // Profile & Settings
    profile_title: 'Game Account (Account)',
    total_spent: 'Total Spent',
    total_orders: 'Total Orders',
    uchiro_points: 'Uchiro Points',
    referral_code: 'Referral Code',
    points_history: 'Points Ledger',
    theme_setting: 'Appearance Theme',
    language_setting: 'Language / ភាសា',
    music_toggle: 'Background Music',
    support_tickets: 'Support Tickets',
    open_support_ticket: 'Contact Support',
  },
  km: {
    // Navigation & Tabs
    tab_home: 'ទំព័រដើម',
    tab_shop: 'ហាងទំនិញ',
    tab_gacha: 'កាឆា',
    tab_orders: 'ការបញ្ជាទិញ',
    tab_profile: 'គណនីហ្គេម (Account)',

    // Header
    store_title: 'UCHIRO STORE',
    points_label: 'ពិន្ទុ',
    open_store: 'បើកហាង',

    // Home
    home_hero_title: 'ហ្គេម និងគណនីលំដាប់កំពូល',
    home_hero_subtitle: 'ផ្ញើជូនភ្លាមៗ (Auto) • ធានាជូន ១៤ ថ្ងៃ • សុវត្ថិភាព ១០០%',
    in_stock_now: 'មានក្នុងស្តុក',
    in_stock_badge: 'មានក្នុងស្តុក',
    instant_delivery_badge: 'ផ្ញើជូនភ្លាមៗ (Auto)',
    out_of_stock: 'អស់ស្តុកហើយ',
    coming_soon: 'នឹងមកដល់ឆាប់ៗ',
    filter_all: 'ទាំងអស់',
    collections: 'បណ្តុំហ្គេម',
    featured_products: 'ទំនិញលេចធ្លោ',
    all_products: 'ទំនិញទាំងអស់ →',
    view_all: 'មើលទាំងអស់',
    shop_now: 'ទិញភ្លាមៗ',

    // Shop
    shop_title: 'បញ្ជីទំនិញហ្គេម',
    shop_search_placeholder: 'ស្វែងរកគណនី, ផ្លែឈើ, កូដ...',
    select_game_category: 'ជ្រើសរើសប្រភេទហ្គេម',
    filter_accounts: 'គណនីហ្គេម (Account)',
    filter_gifts: 'កាដូហ្គេម',
    filter_trades: 'ទំនិញដោះដូរ',
    filter_codes: 'កូដឌីជីថល (Code)',
    sort_featured: 'ពិសេស',
    sort_price_low: 'តម្លៃ៖ ទាបទៅខ្ពស់',
    sort_price_high: 'តម្លៃ៖ ខ្ពស់ទៅទាប',
    sort_popular: 'ពេញនិយមបំផុត',

    // Product Detail
    specifications: 'លក្ខណៈពិសេស',
    warranty_info: 'ធានាជូន ១៤ ថ្ងៃ',
    warranty_desc: 'ធានាជូន ១៤ ថ្ងៃ ដរាបណា Email និង Authenticator ដើមមិនត្រូវបានលុបចេញ។',
    viewers_watching: 'នាក់កំពុងមើលឥឡូវនេះ',
    buy_now: 'ទិញភ្លាមៗ',
    instant_buy: 'ទិញភ្លាមៗ',
    roblox_username_required: 'សូមបញ្ចូលឈ្មោះ Roblox របស់អ្នក',
    roblox_username_label: 'សូមបញ្ចូលឈ្មោះ Roblox របស់អ្នក',

    // Checkout & Payment
    checkout_title: 'បញ្ជាក់ការបញ្ជាទិញ',
    subtotal: 'តម្លៃសរុប',
    discount: 'បញ្ចុះតម្លៃ',
    total_amount: 'ទឹកប្រាក់ត្រូវបង់',
    apply_coupon: 'បញ្ចូលប័ណ្ណបញ្ចុះតម្លៃ',
    coupon_code: 'លេខកូដប័ណ្ណ',
    apply: 'ប្រើប្រាស់',
    proceed_to_payment: 'បន្តទៅការបង់ប្រាក់ KHPay',
    payment_title: 'ស្កេនទូទាត់ជាមួយ KHPay',
    payment_countdown: 'រយៈពេលទូទាត់នៅសល់',
    open_aba: 'បើក ABA Mobile',
    open_bakong: 'បើកកម្មវិធីធនាគារ',
    copy_payment_data: 'ចម្លងព័ត៌មានទូទាត់',
    verifying_payment: 'កំពុងផ្ទៀងផ្ទាត់ការទូទាត់...',
    payment_successful: 'ការទូទាត់ទទួលបានជោគជ័យ!',

    // Delivered Order & Authenticator
    order_delivered: 'ផ្ញើជូនភ្លាមៗ (Auto) ជោគជ័យ',
    credentials_vault: 'ប្រអប់សុវត្ថិភាពគណនី',
    username: 'ឈ្មោះគណនី',
    password: 'ពាក្យសម្ងាត់',
    email: 'អ៊ីមែល',
    email_password: 'ពាក្យសម្ងាត់អ៊ីមែល',
    authenticator: 'ប្រព័ន្ធផ្ទៀងផ្ទាត់ (2FA)',
    live_totp_code: 'កូដ Authenticator ៦ ខ្ទង់បន្តផ្ទាល់',
    expires_in: 'ផុតកំណត់ក្នុងរយះពេល',
    refresh: 'ទាញយកកូដថ្មី',
    import_authenticator: 'បញ្ចូលទៅកាន់ Authenticator App',
    view_backup_codes: 'មើលកូដបម្រុងទុក',
    copy: 'ចម្លង',
    copied: 'បានចម្លង!',
    reveal: 'បង្ហាញ',
    hide: 'លាក់',
    security_warning: 'សូមរក្សា Authenticator និង Email ឱ្យមានសុវត្ថិភាព។ កុំលុបពួកវាចោល។',
    warranty_status_active: 'ធានាជូន ១៤ ថ្ងៃ',

    // Authenticator Modal
    import_modal_title: 'បញ្ចូល Authenticator',
    scan_qr: 'ស្កេន QR Code',
    copy_setup_key: 'ចម្លង Setup Key',
    copy_uri: 'ចម្លង Authenticator URI',
    setup_steps: '១. បើក Google Authenticator ឬ 1Password\n២. បន្ថែមគណនីថ្មី\n៣. ស្កេន QR ឬបិទភ្ជាប់ setup key\n៤. កម្មវិធីនឹងបង្កើតកូដ ៦ ខ្ទង់ដោយស្វ័យប្រវត្តិ។',

    // Gacha & Rewards
    gacha_title: 'ហឹបកំណប់សំណាង',
    gacha_subtitle: 'រង្វាន់ពិន្ទុ Blox Fruits & MM2',
    spin_cost: 'តម្លៃបង្វិល៖ ១០០ ពិន្ទុ',
    available_points: 'ពិន្ទុរបស់អ្នក',
    spin_now: 'បង្វិល (១០០ ពិន្ទុ)',
    spinning: 'កំពុងបើករង្វាន់...',
    reward_congratulations: 'អបអរសាទរ!',
    redeem_coupon_from_points: 'ប្តូរយកប័ណ្ណ $1 (១០០ ពិន្ទុ)',
    daily_reward: 'យកពិន្ទុប្រចាំថ្ងៃ',
    claim_daily: 'យកពិន្ទុ',
    streak_days: 'ថ្ងៃជាប់ៗគ្នា',
    already_claimed_today: 'អ្នកបានយកពិន្ទុថ្ងៃនេះរួចហើយ (ចាំថ្ងៃស្អែក)',

    // Profile & Settings
    profile_title: 'គណនីហ្គេម (Account)',
    total_spent: 'ការចំណាយសរុប',
    total_orders: 'ចំនួនកុម្ម៉ង់សរុប',
    uchiro_points: 'ពិន្ទុ Uchiro',
    referral_code: 'កូដណែនាំ',
    points_history: 'ប្រវត្តិពិន្ទុ',
    theme_setting: 'រូបរាង / ពណ៌',
    language_setting: 'ភាសា / Language',
    music_toggle: 'តន្ត្រីផ្ទៃខាងក្រោយ',
    support_tickets: 'ជំនួយ និងសេវាកម្ម',
    open_support_ticket: 'ទាក់ទងផ្នែកជំនួយ',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations.en) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'km',
  setLanguage: () => {},
  t: (key) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<'km' | 'en'>(
    () => (localStorage.getItem('uchiro_lang') as 'km' | 'en') || 'km'
  );

  const handleSetLanguage = (lang: 'km' | 'en') => {
    setLanguage(lang);
    localStorage.setItem('uchiro_lang', lang);
    localStorage.setItem('uchiro_store_lang', lang);
  };

  const t = (key: keyof typeof translations.en): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
