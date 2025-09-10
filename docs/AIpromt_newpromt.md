We already have the basic setup: React/Vite/TypeScript + ShadCN, connected to Supabase. As descriped in the @readme.md We have succesfully enabled MCP tools for git and supabase. 

 - We have connected gamestate.ts (datemanement) to database for persistant datemanagement database.ts
 - We have a basic UI mosty in \components. With state update hooks \hooks
 - We have basic vineyard functions to create vineyard, plant, and harvest. and basic inventory where harvest can be stores. services/vineyardService.ts and  services/wineBatchService.ts
 - WE now store winebatch from harvest and have winery actions to manipulate them from grape to bottled wine. (wineryService.ts)
 - We now have a salesService.ts that provide functions to create and fullfill orders. And we have a calculator.ts that provide advanced math functions
 - We have updated the header, with a navigation menu (Players menu) and we have implementet a notification service. layout/notificationCenter.tsx 

Next up we want to implement the finance system. I have attached a bunch of files from the old iteration. Its not simple at all, and should be connected to the notificationSystem, but we should be pretty much able to copy it 1to1 from the old iteration. For now lets just make a placeholder for everything that has to do with research and upgrade. 
