import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  AllowNull,
} from "sequelize-typescript";
import { Restaurant } from "./Restaurant";
import { Feature } from "./Feature";
import { User } from "./User";

/** Direct per-restaurant feature grant — overrides plan, granted by admin */
@Table({ tableName: "restaurant_features" })
export class RestaurantFeature extends Model {
  @ForeignKey(() => Restaurant)
  @Column(DataType.UUID)
  declare restaurantId: string;

  @ForeignKey(() => Feature)
  @Column(DataType.UUID)
  declare featureId: string;

  /** Admin who granted this */
  @AllowNull(true)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare grantedBy: string | null;

  @BelongsTo(() => Restaurant)
  declare restaurant: Restaurant;

  @BelongsTo(() => Feature)
  declare feature: Feature;

  @BelongsTo(() => User, "grantedBy")
  declare granter: User;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
