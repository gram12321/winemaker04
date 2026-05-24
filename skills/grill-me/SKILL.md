---
name: grill-me
description: Use when user ask assistant for major updates, usually assisted by design documentation. Use for improving exsisting domain model, sharpen terminology, and align on ADRs. Use for design discussions grounded in the codebase and documentation, especially when resolving ambiguity or disagreement about domain concepts, relationships, or boundaries. 
---

In winemaker04, this is non-default. Route through `../winemaker-game/SKILL.md` unless the user explicitly requests grilling. Prefer this skill over grill-with-docs unless specific reason to grill-with-docs. 

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time.

If a question can be answered by exploring the codebase, explore the codebase instead.
