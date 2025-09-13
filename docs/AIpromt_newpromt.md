We already have the basic setup: React/Vite/TypeScript + ShadCN, connected to Supabase. As descriped in the @readme.md We have succesfully enabled MCP tools for git and supabase. 

 - We have connected gamestate.ts (datemanement) to database for persistant datemanagement database.ts
 - We have a basic UI mosty in \components. With state update hooks \hooks
 - We have basic vineyard functions to create vineyard, plant, and harvest. and basic inventory where harvest can be stores. services/vineyardService.ts and  services/wineBatchService.ts
 - WE now store winebatch from harvest and have winery actions to manipulate them from grape to bottled wine. (wineryService.ts)
 - We now have a salesService.ts that provide functions to create and fullfill orders. And we have a calculator.ts that provide advanced math functions
 - We have updated the header, with a navigation menu (Players menu) and we have implementet a notification service. layout/notificationCenter.tsx 
 - We have a financesystem, financeservice.ts with a transaction system that should be used for all moneytrary transfers. 

We have been working a lot on the customers. They are now created a gameinit and have a type, that makes them act in different ways.  lib\services\sales\*.ts and C:\GitHub\winemaker04\src\lib\services\customerDatabaseService.ts
