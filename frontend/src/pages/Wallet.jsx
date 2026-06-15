import WalletCard from "../components/WalletCard.jsx";

export default function Wallet() {
  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__title">
          <h1 className="heading-1">Wallet</h1>
          <p className="text-muted">
            Deposit or withdraw funds instantly via M-Pesa.
          </p>
        </div>
      </div>

      <WalletCard />
    </div>
  );
}