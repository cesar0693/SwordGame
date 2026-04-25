/**
 * Translation dictionary. Add a key here, then call t('your.key') anywhere.
 * Keys are dot-namespaced by feature. Missing translations fall back to FR.
 *
 * NB: only the core/UI shell + most-used screens are wired for i18n today.
 * Secondary panels (forge, missions, arena…) keep French strings inline;
 * migrating them is straightforward — wrap each label in `t('panel.key')`.
 */
export type Lang = 'fr' | 'en';

export const SUPPORTED_LANGS: Lang[] = ['fr', 'en'];

export const DICTIONARY: Record<Lang, Record<string, string>> = {
  fr: {
    // top bar
    'topbar.logout': 'Déconnexion',
    'topbar.lang': 'Langue',

    // auth
    'auth.login.title': 'Connexion',
    'auth.login.email': 'Email',
    'auth.login.password': 'Mot de passe',
    'auth.login.submit': 'Se connecter',
    'auth.login.submitting': 'Connexion…',
    'auth.login.invalid': 'Identifiants invalides',
    'auth.login.noAccount': 'Pas encore de compte ?',
    'auth.login.create': 'Créer un héros',

    'auth.register.title': 'Créer un compte',
    'auth.register.username': 'Pseudo',
    'auth.register.email': 'Email',
    'auth.register.password': 'Mot de passe (8+)',
    'auth.register.submit': 'Créer mon compte',
    'auth.register.submitting': 'Création…',
    'auth.register.failed': 'Inscription impossible',
    'auth.register.haveAccount': 'Déjà un compte ?',
    'auth.register.signin': 'Se connecter',

    // dock
    'dock.profile': 'Profil',
    'dock.camp': 'Camp',
    'dock.market': 'Marché',
    'dock.dailies': 'Journalier',
    'dock.inventory': 'Sac',
    'dock.missions': 'Missions',
    'dock.forge': 'Forge',
    'dock.spells': 'Sorts',
    'dock.arena': 'Arène',

    // profile
    'profile.title': 'Profil du héros',
    'profile.level': 'Niveau',
    'profile.col.stat': 'Stat',
    'profile.col.base': 'Base',
    'profile.col.bonus': 'Bonus',
    'profile.col.eff': 'Effectif',
    'profile.points.available': 'Points disponibles',
    'profile.points.hint': 'clique sur + à côté d\'une stat pour le dépenser.',

    // class names
    'class.WARRIOR': 'Guerrier',
    'class.MAGE': 'Mage',
    'class.RANGER': 'Rôdeur',

    // daily panel
    'daily.title': 'Journalier',
    'daily.tab.claim': 'Connexion',
    'daily.tab.quests': 'Quêtes',
    'daily.tab.minigames': 'Mini-jeux',
    'daily.streak': 'Streak actuel',
    'daily.claim': 'Réclamer',
    'daily.claiming': 'Réclamation…',
    'daily.alreadyClaimed': 'Déjà réclamé aujourd\'hui. Reviens demain !',

    // common
    'common.close': 'Fermer',
    'common.error': 'Erreur',
    'common.loading': 'Chargement…',
  },
  en: {
    'topbar.logout': 'Log out',
    'topbar.lang': 'Language',

    'auth.login.title': 'Sign in',
    'auth.login.email': 'Email',
    'auth.login.password': 'Password',
    'auth.login.submit': 'Sign in',
    'auth.login.submitting': 'Signing in…',
    'auth.login.invalid': 'Invalid credentials',
    'auth.login.noAccount': 'No account yet?',
    'auth.login.create': 'Create a hero',

    'auth.register.title': 'Create account',
    'auth.register.username': 'Username',
    'auth.register.email': 'Email',
    'auth.register.password': 'Password (8+)',
    'auth.register.submit': 'Create account',
    'auth.register.submitting': 'Creating…',
    'auth.register.failed': 'Registration failed',
    'auth.register.haveAccount': 'Already have an account?',
    'auth.register.signin': 'Sign in',

    'dock.profile': 'Profile',
    'dock.camp': 'Camp',
    'dock.market': 'Market',
    'dock.dailies': 'Daily',
    'dock.inventory': 'Bag',
    'dock.missions': 'Missions',
    'dock.forge': 'Forge',
    'dock.spells': 'Spells',
    'dock.arena': 'Arena',

    'profile.title': 'Hero profile',
    'profile.level': 'Level',
    'profile.col.stat': 'Stat',
    'profile.col.base': 'Base',
    'profile.col.bonus': 'Bonus',
    'profile.col.eff': 'Effective',
    'profile.points.available': 'Available points',
    'profile.points.hint': 'click + next to a stat to spend it.',

    'class.WARRIOR': 'Warrior',
    'class.MAGE': 'Mage',
    'class.RANGER': 'Ranger',

    'daily.title': 'Daily',
    'daily.tab.claim': 'Login',
    'daily.tab.quests': 'Quests',
    'daily.tab.minigames': 'Minigames',
    'daily.streak': 'Current streak',
    'daily.claim': 'Claim',
    'daily.claiming': 'Claiming…',
    'daily.alreadyClaimed': 'Already claimed today. Come back tomorrow!',

    'common.close': 'Close',
    'common.error': 'Error',
    'common.loading': 'Loading…',
  },
};
