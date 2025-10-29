-- Update existing project categories to new taxonomy
-- Old -> New mappings:
-- blockchain            -> blockchain-infra
-- defi                  -> defi-engineering
-- nft                   -> nft-solutions
-- marketing             -> web3-marketing
-- design                -> ui-ux-design
-- smart-contracts       -> smart-contracts (unchanged key)
-- dapp-development      -> dapp-development (unchanged key)
-- web3-frontend         -> web3-frontend (unchanged key)

BEGIN;

UPDATE projects
SET category = CASE category
  WHEN 'blockchain' THEN 'blockchain-infra'
  WHEN 'defi' THEN 'defi-engineering'
  WHEN 'nft' THEN 'nft-solutions'
  WHEN 'marketing' THEN 'web3-marketing'
  WHEN 'design' THEN 'ui-ux-design'
  ELSE category
END
WHERE category IN ('blockchain','defi','nft','marketing','design');

COMMIT;


