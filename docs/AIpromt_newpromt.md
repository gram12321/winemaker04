We  have succesfully create the initial setup and basic frontend and connection to backend supabase As descriped in the @readme.md we use react/vite, typescript, ShadCN. We have succesfully enabled MCP tools for git and supabase. We have connected gamestate to database for persistant datemanagement

We now have a basic UI. 

Next we want to implement the very basic vineyard management. Nothing fancy. Just a way to create a vineyard, decide grapevariety, size. And btns to plant, and harvest. For now we will NOT integrate this with gametime. We will simply build the btns and function for plant, and harvest. We do want to change the status of the vineyard. IE Barren, Planted, Growing, Harvested, Dormant. Keep in mind that once planted, it doesnot go back to Barren. Loop is Harvest -> Dormant -> Growing. Barren/Planted is a Booleen not related to the "Growing" loop of the vineyards. 
We do want the harvest to put something in the inventory. Thus we need to create a simple inventory and likely a inventoryService.  

task is:
1. Create a function to create vineyard including basic parameters
2. Growing loop for vineyards including barren/planted boolean
3. Harvest functionality -> Vineyard goes into Dormant, grapes inherrit parameters from vineyards (name, vintage, grapesvariety), grapes are put in inventory
4. Create simple inventory for grape storage. And display it in winery page. 