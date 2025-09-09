We already have the basic setup: React/Vite/TypeScript + ShadCN, connected to Supabase. As descriped in the @readme.md We have succesfully enabled MCP tools for git and supabase. 

 - We have connected gamestate (datemanement) to database for persistant datemanagement
 - We  have a basic UI. With state update hooks
 - We have basic vineyard functions to create vineyard, plant, and harvest.
 - We have very basic inventory where harvest can be stores. 
 - WE now store winebatch from harvest and have winery actions to manipulate them from grape to bottled wine. 


Next we want to implement the sales operations. We didn't do this in the most reasont iteration of the game, so we have to go all the way back to vanilla .js version for inspiration. At that point we had both sellorders and contract way of selling wines. We eventually do want both in this iteration as well, but for now we will do simple order sales. 

The old sales.js has extreamly sofisticated price calculations and lots of different methods for pricecalculations,  haggling, negotiation, price range at extreams (quality and price). 

For now we want to consider this, because we will want to implement most of it later (Maybe in a more sophisticated way, more ts,react freindly) but for now, we want it simple as possible. 
Base Price = Quality × Wine Balance
Sell Value = Quantity × Base Price

And we dont have a finance system in place yet, so we will just use the addmoney() which i think is allready present somewhere in the codebase. 



task is:
1. Read sales.js and contract.js and think about that we want something that can eventually scale into similiar sophisticated sales methods. 
2. Implement a create order function and a way to display to user what order is avalible
3. Crate a sell/refuse order btn and funtions that remove the order and/or add money to playersmoney (IE finance is not implementet this is solely to show that sell is working)