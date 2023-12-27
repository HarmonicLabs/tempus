cardano-cli transaction build  \
	--$preview \
	 \
     --tx-in $(cat other_tx_infos/contract_tx_in.txt) \
     --spending-tx-in-reference $(cat other_tx_infos/contract_ref_tx_in.txt) \
     --spending-plutus-script-v2 \
     --spending-reference-tx-in-inline-datum-present \
	--spending-reference-tx-in-redeemer-cbor-file cbors/nonce_redeemer.cbor \
 \
	--tx-in $(cat other_tx_infos/miner_tx_in.txt) \
	 \
	--mint 0+"5000000000 $(cat other_tx_infos/mint_policy_id.txt).54454d50555241" \
	--mint-tx-in-reference $(cat other_tx_infos/contract_ref_tx_in.txt) \
        --mint-plutus-script-v2 \
        --mint-reference-tx-in-redeemer-cbor-file cbors/unit.cbor \
        --policy-id $(cat other_tx_infos/mint_policy_id.txt) \
	 \
	--tx-out addr_test1wqhmvpy99z3snv7e4zagz963ap9wswgxhryd4ex2p90aj9chlqq58+2612020+"1 $(cat other_tx_infos/mint_policy_id.txt).6974616d6165" \
	--tx-out-inline-datum-cbor-file cbors/next_state_datum.cbor \
	 \
	--invalid-before $(cat other_tx_infos/invalid_before.int.txt) \
	--invalid-hereafter $(cat other_tx_infos/invalid_before.int.txt) \
	 \
	--change-address addr_test1vqfcv7cymvz5e25k25mclcmlahh8q2vjf7lpysug0hp4lkqg65nup \
	 \
	--tx-in-collateral $(cat other_tx_infos/miner_tx_in.txt) \
	--out-file tx.json
