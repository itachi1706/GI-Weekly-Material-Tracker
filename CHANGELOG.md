# 2.2.0
- Fixed accent color being wrong
- Temporarily disabled ability to tell if promo code has expired due to update in data source
- Added ability to view wish banners and information
- Added ability to view characters in a wish banner and the pity rates for each banner
- (Web) Added a note to wait a bit when logging in
- (Web) Fixed inability to view changelogs
- Dependencies update
- Refactored some code and squashed some bugs

# 2.1.6
- (HOTFIX) Fixed Google Sign In
- (HOTFIX) Fixed color in dark mode for tab bars

# 2.1.5
- Added promo code support for Web
- Built with Flutter 2.8
- Revamped promo code page to support auto-refresh
- Updated many dependencies, replacing discontinued dependencies
- Resolved deprecated code
- Optimized codebase to make it less buggy

# 2.1.4
- Fixed splash screen to not blind users of dark mode

# 2.1.3
- Updated splash package
- Removed unnecessary dependencies
- Upgraded all dependencies
- Migrated codebase to null-safety
- Notification Icon color is now relevant to the application
- General bug fixes and improvements

# 2.1.2
- Added ability to switch Build Guide sources (More coming soon!)
- General bug fixes and optimizations

# 2.1.1
- Updated to only show released characters, weapons and Materials
- Add option in settings to move all completed tracked items to the bottom
- General bug fixes and optimizations

# 2.1.0
- Added new background color for crossover characters (Aloy)
- Materials will now be removed from weekly planner when it has been fully collected
- General bug fixes and improvements

# 2.0.1
- Week Planner now shows grids dynamically, no more massive or small tiles!
- Added URL-based promo codes that launches a web browser on click
- Added Teyvat Map, Hoyolab Forums and Battle Chronicles quick links on the navigation bar
- Fixed accessing promo code on web app causing users to get stuck
- Fixed promo codes duplicating
- Updated dependencies

# 2.0.0
- Brand new navigation method with drawers!
- Split tracking page and character/weapon/material dictionary apart
- Moved Settings, Parametric Transformer and Daily Login Reminder to drawer
- Fixed Traveler displaying only female gender
- Added a refresh page option for web users
- Fixed web users seeing an unknown icon box in settings for notifications
- Updated various dependencies

# 1.6.1
- Added full names of characters to the character info page if it exists
- Added weapon family to the weapon info page if it is part of a series
- Dependency Updates and Code Optimizations

# 1.6.0
- General bug fixes and improvements
- Added application icon and updated splash screen
- Dependency updates
- Fixed issue when weekly planner tab is blank when you are not tracking any domain materials
- Added bug report and feature suggestion options in the settings page
- Updated talents and constellation description to support colors. This will come in a future update to the data

# 1.5.7
- Fixed bug where parametric transformer reminder is reminding every day
- Various bug fixes and code optimizations for app dependencies

# 1.5.6
- Tweaked notification channels for reminder notifications

# 1.5.5
- Fixed parametric transformer notification causing daily forum login notification to disappear when disabling it

# 1.5.4
- Fixed wrong parametric transformer countdown period

# 1.5.3
- See available promo code for the game
- (Web) Fixed spacing issue between parametric transformer's buttons
- Disabled viewing of promo code on Web as it is currently not supported
- Various bug fixes

# 1.5.2
- Added initial parametric transformer notification reminder feature in overflow menu
- Updated many app dependencies to the latest version
- Fixed webapp not leaving the intiialization page due to a crash
- Fixed iOS build not compiling
- Added button to overflow menu to launch the forum daily check-in page directly
- (Android) Automatically cleans up notification channels if not in use

# 1.5.1
- Hotfix for daily forum notification sounds

# 1.5.0
- Updated some dependencies
- Removed redundant dependencies to reduce app size
- Added a countdown timer in the weekly planner tab
- Implemented an option to allow for daily forum notifications (Beta)
- General app improvements and optimizations

# 1.4.1
- Fixed Traveller not having the correct gender icon
- Updated application dependencies for app stability
- Updated to use new Flutter 2.0
- Minor bug fixes and improvements

# 1.4.0
- Added character captions to character info page
- Added weapon effect name if available to weapon info page
- Fixed issue in light theme where buttons cannot be seen
- General app improvements

# 1.3.1
- Refactored the app to optimize some of the code
- Fixed Tier 10 Talents not showing the roman numeral 'X' in its image
- Fixed Talents not being displayed in the correct order
- Added Character Constellation Info page

# 1.3.0
- Added talent tracking
- Ability to view attack talents and passive talents
- Click on talent name to view talent effect
- Added a constellation tab that currently will only tell you its coming soon

# 1.2.3
- Fixed Web reload simply showing a black screen
- Preparing for inclusion of talent tracking
- Added Domain of Mastery materials into the domains filters
- Weekly Planner can now track materials from Domains of Mastery
- Various minor optimiztion and bug fixes

# 1.2.2
- Optimized clearing of tracking information to be more reliable
- Fix minor crash if you have no tracking information at all
- Added link to source code in about page
- Fixed global ascension page showing character/weapon tiers as 1 tier above its actual tier
- Fixed issue where updating tracked materials in the global ascension page causes the page to refresh when the keyboard is shown/hidden
- Added max possible base attack and secondary stat values into the weapons information page
- Fixed web app on iOS not being able to open up build guide or wiki page

# 1.2.1
- Fixed bug where not tracking one of the 3 categories (characters/weapons/materials) prevents you from tracking/untracking anything

# 1.2.0
- Added link to genshin.gg database to character info page
- Added link to the Genshin Impact Wiki for all characters/weapons/materials
- Added an about app page
- Optimized data retrieval code
- Fixed login for iOS Web App
- Dependency Updates
- Various Bug Fixes and App performance improvements

# 1.1.2
- Fixed bug where switching to filtered view causes tracker page to fail to load if you have a character/weapon/material not present in that filtered data page
- Reduced time splash screen stays on the screen
- Restored tracker tap action
- Long tapping on a tracker card will now display the dialog box instead

# 1.1.0
- Initial beta web support @ https://gi-weekly-material-tracker.web.app/
- Added some basic crash handling tracking for crash reporting
- Implemented an app settings page
- Added dark mode to the application (accessible through app settings)
- Added server selection (through app settings).
    This allows you to be able to select your Genshin Impact Account Server for the Weekly Planner to mark your domains properly

- Marked material count text green when you have accumulated enough materials.
- Updated character and weapon ascension tier colors to denote your current state
    * No Colour - Not currently tracking item
    * Blue - Currently tracking item and gathering materials for that ascension tier
    * Green - Currently tracking item and have finished gathering materials for that ascension tier

- Added Gender colouring to character info page
- Added character element to tracker page
- Added support for landscape mode with more compact grids
- Added button in settings page to clear all tracking data
- Added various tabs to the data pages to filter character/weapon/material data by
    * Characters - Filter by Elements
    * Weapons - Filter by Weapon Type
    * Materials - Filter by item type (Boss/Domain/Speciality)
- Added ability to sort through the data pages
    * All: Rarity (1-5, 5-1)
    * Characters: Weapon Type (A-Z, Z-A), Affliation (A-Z, Z-A), Gender (F/M, M/F), Nation (A-Z, Z-A)
    * Weapons: Base Attack (Ascending/Descending), Secondary Stat Type (A-Z, Z-A)
- Improved overall data retrieval mechanism to reduce calls made to the database
- Added a dialog prompt when clicking on a tracked item to update the quantity
    This is so that you do not have to spam click the +/- button to update the tracked material by more than 1 material
- Added app splash screen to replace previous init screen

# 1.0.1
- Fixed unscrollable consolidated material info page
- Fixed weapon obtained section having dashes
- Updated "Unimplemented" popup to show "Coming soon" instead

# 1.0.0
- First release!
- Added Login Page with Login with Google Support
- Bottom navigation to navigate between sections
- Cached image after first load
- Implemented Logout feature
- Added Materials, Characters and Weapons List with Rarity color and images
- Added Material, Character and Weapon Information Page
- Ability to see currently tracked materials
- Increment and Decrement amount obtained in tracking page
- View daily domains and what is available for you that you are currently tracking
- Added page where you can view consolidated material list
- Added page where you can view consolidated characters/weapons being tracked for that material
