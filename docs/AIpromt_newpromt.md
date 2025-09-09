We already have the basic setup: React/Vite/TypeScript + ShadCN, connected to Supabase. As descriped in the @readme.md We have succesfully enabled MCP tools for git and supabase. 

 - We have connected gamestate (datemanement) to database for persistant datemanagement
 - We  have a basic UI. With state update hooks
 - We have basic vineyard functions to create vineyard, plant, and harvest.
 - We have very basic inventory where harvest can be stores. 


Next we want to implement the winery operations. We want to do this a little bit different than in the previus iteration  C:\GitHub\winemaker04\docs\old_iterations\gameState.ts Instead of just a single "Stage" we will give the winebatch (The grapes/must/wine in the inventory) a stage (grapes/must/wine) and a process 'None' |'fermentation' | 'aging' | 'bottled' 
We want a winery action  'crushing', that for now simply change stage from grape -> must. Once this is done. The next winery action becomes avalible 'Start Fermentation' That changes proces from none (Initial value is none) to fermentation. It starts a timer, Fermentation Progress 0%->100% and as soon as > 0 a new btn "Stop fermentation" becomes avalible. 
Once process = 100% or Stop fermentation is pressed. Process change from 'fermentation' to 'aging' and stage change from 'most' to 'wine'. And immidiatly a new winery action becomes avalible "Bottling". Once this is pressed. Process change from 'aging' to 'bottled'. 

Actions:

Crushing
Action button available if stage = grapes.
Changes stage from grapes → must, process stays "none".

Start Fermentation
Action button available if stage = must and process = "none".
Changes process to "fermentation".
Starts a timer/progress bar (0–100%).

Stop Fermentation
Button becomes available as soon as progress > 0.
Or auto-completes at 100%.
Changes process "fermentation" → "aging", and stage "must" → "wine".

Bottling
Action button available if process = "aging".
Changes process to "bottled" and stage to "bottled".
On bottling, mark the batch complete and format the display name.

task is:
1. Crate a type, or interface or class or whatever is needed for the winebatch IE the class of what is in the inventory. Inpiration can be found in the old gamestate, but avoid any complexity beside what is described here. 
2. Create action btns in winery. And a way to show the user what stage and process is happening to the different winebatches. 
3. In the end somehow we mark the winebatch as completed wine. And format it as "Grapevariety, VineyardName, Vintage"  IE . Pinot Noir, Sylvie, 2025, and we are likely gonna show amount of bottles. 