import { Keypair, SystemProgram, Transaction, PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { MINT_SIZE, TOKEN_2022_PROGRAM_ID, createMintToInstruction, createAssociatedTokenAccountInstruction, getMintLen, createInitializeMetadataPointerInstruction, createInitializeMintInstruction, TYPE_SIZE, LENGTH_SIZE, ExtensionType, mintTo, getOrCreateAssociatedTokenAccount, getAssociatedTokenAddressSync } from "@solana/spl-token"
import { createInitializeInstruction, pack } from '@solana/spl-token-metadata';
// import { AuroraBackground } from './ui/AuroraBackground';


export function TokenLaunchpad() {
    const { connection } = useConnection();
    const wallet = useWallet();

    async function createToken() {
        const mintKeypair = Keypair.generate();

        // Get the image URL or metadata URL provided by the user
        const metadataUri = document.getElementById('img').value;

        const metadata = {
            mint: mintKeypair.publicKey,
            name: document.getElementById('name').value,
            symbol: document.getElementById('symbol').value,
            uri: metadataUri,  // Use the AWS-hosted metadata.json URL
            additionalMetadata: [],
        };

        const mintLen = getMintLen([ExtensionType.MetadataPointer]);
        const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

        const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

        const transaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: wallet.publicKey,
                newAccountPubkey: mintKeypair.publicKey,
                space: mintLen,
                lamports,
                programId: TOKEN_2022_PROGRAM_ID,
            }),
            createInitializeMetadataPointerInstruction(mintKeypair.publicKey, wallet.publicKey, mintKeypair.publicKey, TOKEN_2022_PROGRAM_ID),
            createInitializeMintInstruction(mintKeypair.publicKey, 9, wallet.publicKey, null, TOKEN_2022_PROGRAM_ID),
            createInitializeInstruction({
                programId: TOKEN_2022_PROGRAM_ID,
                mint: mintKeypair.publicKey,
                metadata: mintKeypair.publicKey,
                name: metadata.name,
                symbol: metadata.symbol,
                uri: metadata.uri,  // The uri here is the link to the metadata.json file on AWS
                mintAuthority: wallet.publicKey,
                updateAuthority: wallet.publicKey,
            }),
        );

        transaction.feePayer = wallet.publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        transaction.partialSign(mintKeypair);

        await wallet.sendTransaction(transaction, connection);

        console.log(`Token mint created at ${mintKeypair.publicKey}`);
        const associatedToken = getAssociatedTokenAddressSync(
            mintKeypair.publicKey,
            wallet.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID,
        );

        console.log(associatedToken.toBase58());

        const transaction2 = new Transaction().add(
            createAssociatedTokenAccountInstruction(
                wallet.publicKey,
                associatedToken,
                wallet.publicKey,
                mintKeypair.publicKey,
                TOKEN_2022_PROGRAM_ID,
            ),
        );

        await wallet.sendTransaction(transaction2, connection);

        const transaction3 = new Transaction().add(
            createMintToInstruction(mintKeypair.publicKey, associatedToken, wallet.publicKey, 1000000000, [], TOKEN_2022_PROGRAM_ID)
        );

        await wallet.sendTransaction(transaction3, connection);

        console.log("Minted!");
    }


    async function tranferTokens() {
        const mintPublicKey = new PublicKey("9Pe8r9Mj5YYPuxaTaLpUTrfeukJJfMhW3t13T4aRCzqo");
        const recipientPublicKey = wallet.publicKey;  // Replace with recipient's public key if different
        const associatedTokenAddress = await getAssociatedTokenAddressSync(
            mintPublicKey,
            recipientPublicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );

        const transaction = new Transaction().add(
            createMintToInstruction(
                mintPublicKey, // Mint public key
                associatedTokenAddress, // Associated token address
                wallet.publicKey, // Mint authority
                1000000000, // Amount to mint (adjust as necessary)
                [], // MultiSigners (leave empty if not needed)
                TOKEN_2022_PROGRAM_ID
            )
        );

        transaction.feePayer = wallet.publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        try {
            // Use the wallet's signTransaction method instead of sign method
            const signedTransaction = await wallet.signTransaction(transaction);
            await connection.sendTransaction(signedTransaction, [wallet], { skipPreflight: false });
            console.log(`Tokens sent to ${associatedTokenAddress.toBase58()}`);
        } catch (error) {
            console.error("Error sending transaction:", error);
        }
    }

    return (
        // <AuroraBackground>
        <div style={{
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column'
        }}>
            <h1 className="text-center text-green-500 font-bold text-6xl mb-8">SolMint</h1>
            <input className='inputText' type='text' placeholder='Name' id="name"></input> <br />
            <input className='inputText' type='text' placeholder='Symbol' id="symbol"></input> <br />
            <input className='inputText' type='text' placeholder='Image URL' id="img"></input> <br />
            <input className='inputText' type='text' placeholder='Initial Supply'></input> <br />
            <button onClick={createToken} className='btn bg-emerald-500 rounded-md'>Create a token</button>
        </div>
        // </AuroraBackground>
    );
}