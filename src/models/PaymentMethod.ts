import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  AllowNull,
} from "sequelize-typescript";
import { Restaurant } from "./Restaurant";
import { PaymentProviderKey } from "./Payment";

/**
 * A saved-card recurring handle for a restaurant at one provider.
 * We never store PAN/CVV — only the bank-issued reusable token, encrypted
 * at rest with lib/crypto (AES-256-GCM). The card is held by the bank.
 */
@Table({ tableName: "payment_methods" })
export class PaymentMethod extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Restaurant)
  @Column(DataType.UUID)
  declare restaurantId: string;

  @Column(DataType.STRING)
  declare provider: PaymentProviderKey;

  // Bank recurring/save-card identifier, stored encrypted (enc:... prefix).
  @Column(DataType.TEXT)
  declare recurringToken: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare cardMask: string | null; // e.g. "****1234"

  @AllowNull(true)
  @Column(DataType.STRING)
  declare expiry: string | null; // "MM/YY"

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @BelongsTo(() => Restaurant)
  declare restaurant: Restaurant;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
