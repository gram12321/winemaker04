We already have the basic setup: React/Vite/TypeScript + ShadCN, connected to Supabase. As descriped in the @readme.md We have succesfully enabled MCP tools for git and supabase. 

 - We have connected gamestate.ts (datemanement) to database for persistant datemanagement database.ts
 - We have a basic UI mosty in \components. With state update hooks \hooks
 - We have basic vineyard functions to create vineyard, plant, and harvest. and basic inventory where harvest can be stores. services/vineyardService.ts and  services/wineBatchService.ts
 - WE now store winebatch from harvest and have winery actions to manipulate them from grape to bottled wine. (wineryService.ts)
 - We now have a salesService.ts that provide functions to create and fullfill orders. And we have a calculator.ts that provide advanced math functions
 - We have updated the header, with a navigation menu (Players menu) and we have implementet a notification service. layout/notificationCenter.tsx 
 - We have a financesystem, financeservice.ts with a transaction system that should be used for all moneytrary transfers 

Next up i want to return a bit to the math in calculator.ts. I want to implement the calculateOrderAmount in the salesService likely. The general idea is that we get a complex function for the size of the order. If i recall the old implementation right, this was done by comparing the systems calculated finalprice, with a set price. That the User can set for each (what is now called winebatch/completed wines) . If im right about this then i think we need to implement a setprice functionality likely in the sales.tsx. 
