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
